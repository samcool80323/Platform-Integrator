import { prisma } from "../db";
import { createLocationClient } from "../ghl/auth";
import { upsertContact } from "../ghl/contacts";
import { ensureCustomFields } from "../ghl/custom-fields";
import { addInboundMessage, addOutboundMessage, addContactNote } from "../ghl/conversations";
import { getConnector } from "../connectors/registry";
import { decryptJson } from "../encryption";
import { applyFieldMappings } from "./field-mapper";
import { acquireRateLimit } from "./rate-limiter";
import { emitProgress, emitComplete } from "./progress";
import type { FieldMapping } from "../universal-model/types";

export class MigrationEngine {
  private migrationId: string;
  private sourceIdToGhlId = new Map<string, string>();

  constructor(migrationId: string) {
    this.migrationId = migrationId;
  }

  async run(): Promise<void> {
    const migration = await prisma.migration.findUniqueOrThrow({
      where: { id: this.migrationId },
      include: { connectorCredential: true },
    });

    const connector = getConnector(migration.connectorId);
    if (!connector) throw new Error(`Connector ${migration.connectorId} not found`);

    const creds = decryptJson<Record<string, string>>(
      migration.connectorCredential.credentials
    );
    const fieldMappings = migration.fieldMappings as unknown as FieldMapping[];
    const options = (migration.options || {}) as Record<string, boolean>;

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
        .map((m) => ({
          key: m.sourceField,
          name: m.sourceField
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          dataType: "TEXT",
        }));

      const customFieldIdMap = await ensureCustomFields(
        ghlClient,
        migration.ghlLocationId,
        migration.connectorId,
        connector.name,
        customFieldDefs
      );

      // Phase 2: Migrate contacts
      await this.migrateContacts(
        connector,
        creds,
        ghlClient,
        migration.ghlLocationId,
        fieldMappings,
        customFieldIdMap
      );

      // Phase 3: Migrate conversations (if enabled and supported)
      if (options.importConversations && connector.fetchConversations) {
        await this.migrateConversations(connector, creds, ghlClient);
      }

      // Finalize
      const finalMigration = await prisma.migration.findUniqueOrThrow({
        where: { id: this.migrationId },
      });

      const finalStatus =
        finalMigration.failedContacts > 0 ||
        finalMigration.failedConversations > 0
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

  private async migrateContacts(
    connector: ReturnType<typeof getConnector> & {},
    creds: Record<string, string>,
    ghlClient: Awaited<ReturnType<typeof createLocationClient>>,
    locationId: string,
    fieldMappings: FieldMapping[],
    customFieldIdMap: Record<string, string>
  ): Promise<void> {
    let processed = 0;
    let failed = 0;
    let batchNum = 0;

    const migration = await prisma.migration.findUniqueOrThrow({
      where: { id: this.migrationId },
    });

    for await (const batch of connector.fetchContacts(creds)) {
      batchNum++;

      // Skip already processed batches (for resume)
      if (batchNum <= migration.lastBatchProcessed) continue;

      for (const contact of batch) {
        try {
          await acquireRateLimit(locationId);

          const ghlPayload = applyFieldMappings(contact, fieldMappings, customFieldIdMap);
          const result = await upsertContact(ghlClient, locationId, ghlPayload);

          this.sourceIdToGhlId.set(contact.sourceId, result.contact.id);

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

        // Emit progress every 10 records
        if ((processed + failed) % 10 === 0) {
          await emitProgress({
            migrationId: this.migrationId,
            phase: "contacts",
            processed,
            total: processed + failed, // we don't know total upfront
            failed,
          });
        }
      }

      // Update batch progress in DB (for resume)
      await prisma.migration.update({
        where: { id: this.migrationId },
        data: {
          lastBatchProcessed: batchNum,
          processedContacts: processed,
          failedContacts: failed,
          totalContacts: processed + failed,
        },
      });
    }

    await this.log("INFO", `Contacts migration complete: ${processed} processed, ${failed} failed`);
  }

  private async migrateConversations(
    connector: ReturnType<typeof getConnector> & {},
    creds: Record<string, string>,
    ghlClient: Awaited<ReturnType<typeof createLocationClient>>
  ): Promise<void> {
    if (!connector.fetchConversations) return;

    let processed = 0;
    let failed = 0;

    await emitProgress({
      migrationId: this.migrationId,
      phase: "conversations",
      processed: 0,
      total: 0,
      failed: 0,
      message: "Importing conversations...",
    });

    for await (const batch of connector.fetchConversations(creds)) {
      for (const conv of batch) {
        const ghlContactId = this.sourceIdToGhlId.get(conv.contactSourceId);
        if (!ghlContactId) {
          failed++;
          await this.log("WARN", `Skipping conversation ${conv.sourceId}: no matching GHL contact for source ID ${conv.contactSourceId}`);
          continue;
        }

        // Build a single note body from all messages in the conversation
        const noteLines: string[] = [];
        noteLines.push(`--- Imported ${conv.channel.toUpperCase()} conversation (${conv.messages.length} messages) ---`);

        for (const msg of conv.messages) {
          const time = msg.timestamp.toISOString().replace("T", " ").slice(0, 19);
          const dir = msg.direction === "inbound" ? "IN" : "OUT";
          noteLines.push(`[${time}] [${dir}] ${msg.body}`);
        }

        try {
          await acquireRateLimit("conversations");

          await addContactNote(ghlClient, {
            contactId: ghlContactId,
            body: noteLines.join("\n"),
          });

          processed++;
        } catch (error) {
          failed++;
          const message = error instanceof Error ? error.message : String(error);
          await this.log("ERROR", `Failed to add conversation note for contact ${ghlContactId}: ${message}`);
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

    await this.log("INFO", `Conversations migration complete: ${processed} messages processed, ${failed} failed`);
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
