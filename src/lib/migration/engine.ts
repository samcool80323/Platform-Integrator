import { prisma } from "../db";
import { createLocationClient } from "../ghl/auth";
import { upsertContact } from "../ghl/contacts";
import { ensureCustomFields } from "../ghl/custom-fields";
import { postInternalComment, addContactNote } from "../ghl/conversations";
import { getCalendars, createAppointment } from "../ghl/appointments";
import { getConnector } from "../connectors/registry";
import { decryptJson } from "../encryption";
import { ensureFreshOAuthCredentials } from "../connectors/oauth-refresh";
import { applyFieldMappings } from "./field-mapper";
import { acquireRateLimit } from "./rate-limiter";
import { emitProgress, emitComplete } from "./progress";
import type { FieldMapping, UniversalConversation, UniversalAppointment } from "../universal-model/types";

export class MigrationEngine {
  private migrationId: string;
  private sourceIdToGhlId = new Map<string, string>();
  // For connectors (like Podium) where conversations use contactName instead of ID
  private contactNameToGhlId = new Map<string, string>();

  constructor(migrationId: string) {
    this.migrationId = migrationId;
  }

  async run(testLimit?: number): Promise<void> {
    const migration = await prisma.migration.findUniqueOrThrow({
      where: { id: this.migrationId },
      include: { connectorCredential: true },
    });

    const connector = getConnector(migration.connectorId);
    if (!connector) throw new Error(`Connector ${migration.connectorId} not found`);

    let creds = decryptJson<Record<string, string>>(
      migration.connectorCredential.credentials
    );

    // Refresh OAuth token if expired (e.g. Podium)
    creds = await ensureFreshOAuthCredentials(
      migration.connectorId,
      creds,
      migration.connectorCredentialId
    );

    const fieldMappings = migration.fieldMappings as unknown as FieldMapping[];

    // Update status to RUNNING
    await prisma.migration.update({
      where: { id: this.migrationId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    try {
      // Create GHL client for the target location
      const ghlClient = await createLocationClient(
        migration.userId,
        migration.ghlLocationId
      );

      // Phase 1: Ensure custom fields exist
      await emitProgress({
        migrationId: this.migrationId,
        phase: "custom_fields",
        processed: 0,
        total: 0,
        failed: 0,
        message: "Creating custom fields...",
      });

      const customFieldDefs = fieldMappings
        .filter((m) => m.targetType === "custom")
        .filter((m) => !m.sourceField.startsWith("_")) // Exclude internal fields like _samplePayload
        .map((m) => ({
          key: m.sourceField,
          name: m.customFieldName || cleanFieldName(m.sourceField),
          dataType: "TEXT",
        }));

      // Clear stale custom field cache for this location+connector
      // so fields are recreated with correct clean names
      await prisma.customFieldMapping.deleteMany({
        where: {
          ghlLocationId: migration.ghlLocationId,
          connectorId: migration.connectorId,
        },
      });

      const migrationOptions = (migration.options || {}) as Record<string, unknown>;
      const customFieldIdMap = await ensureCustomFields(
        ghlClient,
        migration.ghlLocationId,
        migration.connectorId,
        connector.name,
        customFieldDefs,
        (migrationOptions.customFieldFolderId as string) || null
      );

      // Rebuild maps from previously imported contacts (needed for "Push All" resume)
      await this.rebuildMapsFromDb();

      // Phase 2: Migrate contacts
      const hitTestLimit = await this.migrateContacts(
        connector,
        creds,
        ghlClient,
        migration.ghlLocationId,
        fieldMappings,
        customFieldIdMap,
        testLimit
      );

      // Phase 3: Import conversations for migrated contacts
      // Works in test mode too — only for contacts we actually pushed
      if (connector.fetchConversationsForContact || connector.fetchConversations) {
        await this.migrateConversations(
          connector,
          creds,
          ghlClient,
          migration.ghlLocationId
        );
      }

      // Phase 4: Import appointments for migrated contacts
      if (connector.fetchAppointments) {
        await this.migrateAppointments(
          connector,
          creds,
          ghlClient,
          migration.ghlLocationId
        );
      }

      // If test limit was hit, pause for review
      if (hitTestLimit) {
        await prisma.migration.update({
          where: { id: this.migrationId },
          data: { status: "PAUSED" },
        });
        await this.log("INFO", `Test import complete — ${testLimit} contacts with conversations. Review in GHL, then click "Push All Contacts" to continue.`);
        await emitComplete(this.migrationId, "paused" as "completed");
        return;
      }

      // Finalize
      const finalMigration = await prisma.migration.findUniqueOrThrow({
        where: { id: this.migrationId },
      });

      const finalStatus =
        finalMigration.failedContacts > 0 ||
        finalMigration.failedConversations > 0 ||
        finalMigration.failedAppointments > 0
          ? "COMPLETED_WITH_ERRORS"
          : "COMPLETED";

      await prisma.migration.update({
        where: { id: this.migrationId },
        data: { status: finalStatus, completedAt: new Date() },
      });

      await emitComplete(this.migrationId, finalStatus as "completed" | "completed_with_errors");
      await this.log("INFO", `Migration ${finalStatus.toLowerCase()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.migration.update({
        where: { id: this.migrationId },
        data: { status: "FAILED", completedAt: new Date() },
      });
      await this.log("ERROR", `Migration failed: ${message}`);
      await emitComplete(this.migrationId, "failed", { error: message });
      throw error;
    }
  }

  /**
   * On resume ("Push All"), reload already-processed contacts from DB
   * so sourceIdToGhlId is populated for conversation/appointment matching.
   */
  private async rebuildMapsFromDb(): Promise<void> {
    const existing = await prisma.migrationRecord.findMany({
      where: {
        migrationId: this.migrationId,
        entityType: "CONTACT",
        status: "SUCCESS",
      },
      select: { sourceId: true, ghlId: true },
    });

    if (existing.length === 0) return;

    for (const record of existing) {
      if (record.ghlId) {
        this.sourceIdToGhlId.set(record.sourceId, record.ghlId);
      }
    }

    await this.log("INFO", `Resumed with ${existing.length} previously imported contacts`);
  }

  private async migrateContacts(
    connector: ReturnType<typeof getConnector> & {},
    creds: Record<string, string>,
    ghlClient: Awaited<ReturnType<typeof createLocationClient>>,
    locationId: string,
    fieldMappings: FieldMapping[],
    customFieldIdMap: Record<string, string>,
    testLimit?: number
  ): Promise<boolean> {
    let processed = 0;
    let failed = 0;
    let batchNum = 0;
    let hitLimit = false;

    const migration = await prisma.migration.findUniqueOrThrow({
      where: { id: this.migrationId },
    });

    for await (const batch of connector.fetchContacts(creds)) {
      batchNum++;

      // Skip already processed batches (for resume)
      if (batchNum <= migration.lastBatchProcessed) continue;

      for (const contact of batch) {
        // Check test limit BEFORE processing — hard stop
        if (testLimit && (processed + failed) >= testLimit) {
          hitLimit = true;
          break;
        }

        try {
          await acquireRateLimit(locationId);

          const ghlPayload = applyFieldMappings(contact, fieldMappings, customFieldIdMap);
          const result = await upsertContact(ghlClient, locationId, ghlPayload);

          this.sourceIdToGhlId.set(contact.sourceId, result.contact.id);

          // Index by name for connectors that match conversations by contactName
          // Try multiple name formats to maximize matching
          const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim().toLowerCase();
          if (fullName) {
            this.contactNameToGhlId.set(`name:${fullName}`, result.contact.id);
          }
          // Also index by the original raw name if available (may differ from first+last split)
          const rawName = String(contact.rawData?.name || "").trim().toLowerCase();
          if (rawName && rawName !== fullName) {
            this.contactNameToGhlId.set(`name:${rawName}`, result.contact.id);
          }
          // Index by phone and email too as fallback matching keys
          if (contact.phone) {
            this.contactNameToGhlId.set(`phone:${contact.phone}`, result.contact.id);
          }
          if (contact.email) {
            this.contactNameToGhlId.set(`email:${contact.email.toLowerCase()}`, result.contact.id);
          }

          await prisma.migrationRecord.create({
            data: {
              migrationId: this.migrationId,
              entityType: "CONTACT",
              sourceId: contact.sourceId,
              ghlId: result.contact.id,
              status: "SUCCESS",
            },
          });

          processed++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          await prisma.migrationRecord.create({
            data: {
              migrationId: this.migrationId,
              entityType: "CONTACT",
              sourceId: contact.sourceId,
              status: "FAILED",
              errorMessage: message,
              sourceData: contact.rawData as unknown as import("@prisma/client").Prisma.InputJsonValue,
            },
          });

          failed++;
          await this.log("ERROR", `Failed to migrate contact ${contact.sourceId}: ${message}`);
        }

        // Emit progress every 5 records
        if ((processed + failed) % 5 === 0) {
          await emitProgress({
            migrationId: this.migrationId,
            phase: "contacts",
            processed,
            total: processed + failed,
            failed,
          });
        }
      }

      // Update batch progress in DB
      await prisma.migration.update({
        where: { id: this.migrationId },
        data: {
          lastBatchProcessed: batchNum,
          processedContacts: processed,
          failedContacts: failed,
          totalContacts: processed + failed,
        },
      });

      if (hitLimit) break;
    }

    await this.log("INFO", `Contacts: ${processed} processed, ${failed} failed`);
    return hitLimit;
  }

  /**
   * Import conversations as internal comments + notes for each migrated contact.
   * Uses per-contact fetching if available, otherwise falls back to bulk fetch.
   */
  private async migrateConversations(
    connector: ReturnType<typeof getConnector> & {},
    creds: Record<string, string>,
    ghlClient: Awaited<ReturnType<typeof createLocationClient>>,
    locationId: string
  ): Promise<void> {
    if (this.sourceIdToGhlId.size === 0) return;

    let processed = 0;
    let failed = 0;

    await emitProgress({
      migrationId: this.migrationId,
      phase: "conversations",
      processed: 0,
      total: this.sourceIdToGhlId.size,
      failed: 0,
      message: "Fetching conversations...",
    });

    // Strategy: fetch conversations per contact for accuracy
    if (connector.fetchConversationsForContact) {
      await this.log("INFO", `Fetching conversations for ${this.sourceIdToGhlId.size} contacts...`);

      for (const [sourceId, ghlContactId] of this.sourceIdToGhlId) {
        try {
          await this.log("DEBUG", `Fetching conversations for contact ${sourceId} (GHL: ${ghlContactId})...`);

          const conversations = await connector.fetchConversationsForContact(creds, sourceId);

          await this.log("DEBUG", `Contact ${sourceId}: found ${conversations.length} conversations with ${conversations.reduce((n, c) => n + c.messages.length, 0)} total messages`);

          if (conversations.length === 0) {
            continue;
          }

          // Build one transcript per contact from ALL their conversations
          const transcript = buildTranscript(conversations, connector.name);

          if (!transcript) continue;

          await acquireRateLimit("conversations");

          // Post as internal comment (visible in conversations tab)
          try {
            await postInternalComment(ghlClient, {
              contactId: ghlContactId,
              locationId,
              message: transcript,
            });
          } catch (err) {
            // If internal comment fails, log but continue to post note
            await this.log("WARN", `Internal comment failed for ${ghlContactId}: ${err instanceof Error ? err.message : String(err)}`);
          }

          // Also post as contact note
          await addContactNote(ghlClient, {
            contactId: ghlContactId,
            body: transcript,
          });

          processed++;

          await emitProgress({
            migrationId: this.migrationId,
            phase: "conversations",
            processed,
            total: this.sourceIdToGhlId.size,
            failed,
            message: `Imported conversations for ${processed} contacts...`,
          });
        } catch (error) {
          failed++;
          const message = error instanceof Error ? error.message : String(error);
          await this.log("ERROR", `Failed conversations for contact ${ghlContactId}: ${message}`);
        }
      }
    } else if (connector.fetchConversations) {
      // Bulk fetch and match — supports both sourceId and contactName matching
      await this.log("INFO", `Fetching all conversations in bulk (${this.sourceIdToGhlId.size} contacts to match, ${this.contactNameToGhlId.size} name entries)...`);

      // Group conversations by contact for a single transcript per contact
      const convsByContact = new Map<string, UniversalConversation[]>();
      let totalConvs = 0;
      let unmatchedSamples: string[] = [];

      // Log a few name map entries for debugging
      const nameMapSample = Array.from(this.contactNameToGhlId.keys()).slice(0, 5);
      await this.log("DEBUG", `Name map sample: ${nameMapSample.join(", ")}`);

      for await (const batch of connector.fetchConversations(creds)) {
        for (const conv of batch) {
          totalConvs++;
          // Try matching by source ID first, then by contact name
          const ghlContactId =
            this.sourceIdToGhlId.get(conv.contactSourceId) ||
            this.contactNameToGhlId.get(conv.contactSourceId);

          if (!ghlContactId) {
            if (unmatchedSamples.length < 5) {
              unmatchedSamples.push(conv.contactSourceId);
            }
            continue;
          }

          if (!convsByContact.has(ghlContactId)) {
            convsByContact.set(ghlContactId, []);
          }
          convsByContact.get(ghlContactId)!.push(conv);
        }
      }

      if (unmatchedSamples.length > 0) {
        await this.log("DEBUG", `Unmatched conversation contactSourceIds (sample): ${unmatchedSamples.join(", ")}`);
      }
      await this.log("INFO", `Matched ${convsByContact.size} of ${totalConvs} conversations to contacts`);

      for (const [ghlContactId, convs] of convsByContact) {
        const transcript = buildTranscript(convs, connector.name);
        if (!transcript) continue;

        try {
          await acquireRateLimit("conversations");

          try {
            await postInternalComment(ghlClient, {
              contactId: ghlContactId,
              locationId,
              message: transcript,
            });
          } catch (err) {
            await this.log("WARN", `Internal comment failed for ${ghlContactId}: ${err instanceof Error ? err.message : String(err)}`);
          }

          await addContactNote(ghlClient, {
            contactId: ghlContactId,
            body: transcript,
          });
          processed++;
        } catch (error) {
          failed++;
          const message = error instanceof Error ? error.message : String(error);
          await this.log("ERROR", `Failed conversation for contact ${ghlContactId}: ${message}`);
        }
      }
    }

    await prisma.migration.update({
      where: { id: this.migrationId },
      data: {
        processedConversations: processed,
        failedConversations: failed,
        totalConversations: processed + failed,
      },
    });

    await this.log("INFO", `Conversations: ${processed} contacts imported, ${failed} failed`);
  }

  /**
   * Import appointments — try GHL calendar first, fall back to internal comment.
   */
  private async migrateAppointments(
    connector: ReturnType<typeof getConnector> & {},
    creds: Record<string, string>,
    ghlClient: Awaited<ReturnType<typeof createLocationClient>>,
    locationId: string
  ): Promise<void> {
    if (this.sourceIdToGhlId.size === 0) return;
    if (!connector.fetchAppointments) return;

    let processed = 0;
    let failed = 0;
    let calendarId: string | null = null;
    let useCalendar = true;

    await emitProgress({
      migrationId: this.migrationId,
      phase: "appointments",
      processed: 0,
      total: 0,
      failed: 0,
      message: "Fetching appointments...",
    });

    // Try to get a GHL calendar to create appointments in
    try {
      const calendars = await getCalendars(ghlClient, locationId);
      if (calendars.length > 0) {
        calendarId = calendars[0].id;
        await this.log("INFO", `Using GHL calendar "${calendars[0].name}" for appointments`);
      } else {
        useCalendar = false;
        await this.log("INFO", "No GHL calendars found — appointments will be posted as internal comments");
      }
    } catch {
      useCalendar = false;
      await this.log("INFO", "Could not fetch GHL calendars — appointments will be posted as internal comments");
    }

    // Collect appointments per contact for transcript fallback
    const appointmentsByContact = new Map<string, UniversalAppointment[]>();

    for await (const batch of connector.fetchAppointments(creds)) {
      for (const appt of batch) {
        const ghlContactId = this.sourceIdToGhlId.get(appt.contactSourceId);
        if (!ghlContactId) continue;

        if (useCalendar && calendarId) {
          // Try to create in GHL calendar
          try {
            await acquireRateLimit("appointments");
            await createAppointment(ghlClient, {
              calendarId,
              contactId: ghlContactId,
              title: appt.title,
              startTime: appt.startTime.toISOString(),
              endTime: appt.endTime.toISOString(),
              status: appt.status === "confirmed" ? "confirmed" : appt.status,
              notes: appt.notes,
            });
            processed++;
          } catch (error) {
            // Calendar creation failed — collect for internal comment fallback
            const message = error instanceof Error ? error.message : String(error);
            await this.log("WARN", `Calendar appointment failed for ${ghlContactId}: ${message} — falling back to internal comment`);

            if (!appointmentsByContact.has(ghlContactId)) {
              appointmentsByContact.set(ghlContactId, []);
            }
            appointmentsByContact.get(ghlContactId)!.push(appt);
          }
        } else {
          // No calendar — collect for internal comment
          if (!appointmentsByContact.has(ghlContactId)) {
            appointmentsByContact.set(ghlContactId, []);
          }
          appointmentsByContact.get(ghlContactId)!.push(appt);
        }
      }
    }

    // Post collected appointments as internal comments
    for (const [ghlContactId, appointments] of appointmentsByContact) {
      try {
        const transcript = buildAppointmentTranscript(appointments, connector.name);
        if (!transcript) continue;

        await acquireRateLimit("appointments");

        try {
          await postInternalComment(ghlClient, {
            contactId: ghlContactId,
            locationId,
            message: transcript,
          });
        } catch (err) {
          await this.log("WARN", `Appointment internal comment failed for ${ghlContactId}: ${err instanceof Error ? err.message : String(err)}`);
        }

        await addContactNote(ghlClient, {
          contactId: ghlContactId,
          body: transcript,
        });

        processed++;
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : String(error);
        await this.log("ERROR", `Failed appointment import for contact ${ghlContactId}: ${message}`);
      }
    }

    await prisma.migration.update({
      where: { id: this.migrationId },
      data: {
        processedAppointments: processed,
        failedAppointments: failed,
        totalAppointments: processed + failed,
      },
    });

    await emitProgress({
      migrationId: this.migrationId,
      phase: "appointments",
      processed,
      total: processed + failed,
      failed,
      message: `Appointments: ${processed} imported, ${failed} failed`,
    });

    await this.log("INFO", `Appointments: ${processed} imported, ${failed} failed`);
  }

  private async log(level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string) {
    await prisma.migrationLog.create({
      data: {
        migrationId: this.migrationId,
        level,
        message,
      },
    });
  }
}

/**
 * Clean a source field key into a human-readable GHL custom field name.
 * Strips prefixes like "attr:", "custom:", replaces separators, title-cases.
 * e.g. "attr:Birthday" → "Birthday"
 *      "attr:Opportunity Value" → "Opportunity Value"
 *      "Initial_Contact" → "Initial Contact"
 *      "is it spam ?" → "Is It Spam ?"
 */
function cleanFieldName(sourceField: string): string {
  return sourceField
    .replace(/^attr:/i, "")    // Strip "attr:" prefix (case-insensitive)
    .replace(/^custom:/i, "")  // Strip "custom:" prefix
    .replace(/^_+/, "")        // Strip leading underscores
    .replace(/[_-]/g, " ")     // Replace underscores/dashes with spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()) // Title case
    .trim();
}

// ── Transcript builder ──────────────────────────────────────────────

const COL_SEP = "  |  ";

/**
 * Build a formatted transcript from all conversations for a contact.
 * Matches the format from the n8n workflow:
 *   Timestamp  |  From  |  Message
 * Messages sorted oldest-first across all conversations.
 */
function buildTranscript(
  conversations: UniversalConversation[],
  connectorName: string
): string | null {
  // Collect all messages across all conversations
  const allMessages: { direction: "inbound" | "outbound"; body: string; timestamp: Date; channel: string }[] = [];

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (!msg.body) continue;
      allMessages.push({
        direction: msg.direction,
        body: msg.body,
        timestamp: msg.timestamp,
        channel: conv.channel,
      });
    }
  }

  if (allMessages.length === 0) return null;

  // Sort oldest first
  allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const first = allMessages[0];
  const last = allMessages[allMessages.length - 1];
  const sep = "\u2500".repeat(50); // ─

  const lines: string[] = [];

  for (const msg of allMessages) {
    const ts = formatTimestamp(msg.timestamp);
    const from = msg.direction === "inbound" ? "Contact " : "Clinic  ";
    const bodyLines = msg.body.split("\n");
    const indent = " ".repeat(22 + COL_SEP.length + 8 + COL_SEP.length);

    const firstLine = `${ts}${COL_SEP}${from}${COL_SEP}${bodyLines[0]}`;
    const rest = bodyLines.slice(1).map((l) => `${indent}${l}`);
    lines.push([firstLine, ...rest].join("\n"));
  }

  const header = [
    `${connectorName.toUpperCase()} CONVERSATION IMPORT`,
    sep,
    `Started       ${formatTimestamp(first.timestamp).trim()}`,
    `Last activity ${formatTimestamp(last.timestamp).trim()}`,
    `Messages      ${allMessages.length}`,
    sep,
    "",
    `${"Timestamp".padEnd(22)}${COL_SEP}${"From".padEnd(8)}${COL_SEP}Message`,
    "\u2500".repeat(22) + "\u2500".repeat(COL_SEP.length) + "\u2500".repeat(8) + "\u2500".repeat(COL_SEP.length) + "\u2500".repeat(10),
    "",
  ];

  return [...header, ...lines].join("\n");
}

/**
 * Build a formatted transcript of appointments for a contact.
 * Used when appointments can't be added to a GHL calendar.
 */
function buildAppointmentTranscript(
  appointments: UniversalAppointment[],
  connectorName: string
): string | null {
  if (appointments.length === 0) return null;

  // Sort by start time, oldest first
  const sorted = [...appointments].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  const sep = "\u2500".repeat(50);

  const lines: string[] = [];

  for (const appt of sorted) {
    const start = formatTimestamp(appt.startTime);
    const end = formatTimestamp(appt.endTime);
    const status = appt.status.charAt(0).toUpperCase() + appt.status.slice(1);
    const parts = [
      `${start.trim()}${COL_SEP}${appt.title}${COL_SEP}${status}`,
    ];
    if (appt.notes) {
      parts.push(`${"".padEnd(22)}${COL_SEP}Notes: ${appt.notes}`);
    }
    parts.push(`${"".padEnd(22)}${COL_SEP}Ends: ${end.trim()}`);
    lines.push(parts.join("\n"));
  }

  const header = [
    `${connectorName.toUpperCase()} APPOINTMENT IMPORT`,
    sep,
    `Total appointments  ${sorted.length}`,
    `Earliest            ${formatTimestamp(sorted[0].startTime).trim()}`,
    `Latest              ${formatTimestamp(sorted[sorted.length - 1].startTime).trim()}`,
    sep,
    "",
    `${"Date / Time".padEnd(22)}${COL_SEP}${"Title".padEnd(20)}${COL_SEP}Status`,
    "\u2500".repeat(22) + "\u2500".repeat(COL_SEP.length) + "\u2500".repeat(20) + "\u2500".repeat(COL_SEP.length) + "\u2500".repeat(10),
    "",
  ];

  return [...header, ...lines].join("\n");
}

function formatTimestamp(date: Date): string {
  try {
    return date
      .toLocaleString("en-AU", {
        timeZone: "Australia/Sydney",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      .padEnd(22);
  } catch {
    return date.toISOString().replace("T", " ").slice(0, 19).padEnd(22);
  }
}
