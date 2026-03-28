import type { PlatformConnector, AuthConfig, ConnectorCapabilities } from "../types";
import type {
  FieldSchema,
  FieldMapping,
  UniversalContact,
  UniversalConversation,
  UniversalMessage,
} from "../../universal-model/types";

const PODIUM_API_BASE = "https://api.podium.com/v4";

// Internal structural fields — never show in field mapping
const SKIP_FIELDS = new Set([
  "uid", "createdAt", "updatedAt", "locations", "conversations", "organization",
]);

const CREDENTIAL_GUIDE = `## How to connect Podium

Podium uses OAuth 2.0. Click "Connect with Podium" and log in — no keys to copy.

**First**, register Platform Integrator as an app in Podium:

1. Go to **https://app.podium.com** and sign in (must be Admin)
2. Settings → Integrations → API/Developer
3. Create New Application, set the **Redirect URI** from your Settings page
4. Copy the **Client ID** and **Client Secret** into Platform Integrator Settings
5. Come back here and click **Connect with Podium**
`;

export class PodiumConnector implements PlatformConnector {
  id = "podium";
  name = "Podium";
  logo = "/logos/podium.svg";
  description = "Import contacts, conversations, and reviews from Podium";

  authConfig: AuthConfig = {
    type: "oauth2",
    authorizationUrl: "https://api.podium.com/oauth/authorize",
    tokenUrl: "https://api.podium.com/oauth/token",
    scopes: ["read_contacts", "read_messages", "read_locations"],
    scopeDescriptions: {
      read_contacts: "Read your contacts list",
      read_messages: "Read conversations and messages",
      read_locations: "Read location info (used to verify connection)",
    },
  };

  capabilities: ConnectorCapabilities = {
    contacts: true,
    conversations: true,
    opportunities: false,
    appointments: false,
  };

  credentialGuide = CREDENTIAL_GUIDE;

  async validateCredentials(
    creds: Record<string, string>
  ): Promise<{ valid: boolean; error?: string; accountName?: string }> {
    try {
      const res = await fetch(`${PODIUM_API_BASE}/locations`, {
        headers: { Authorization: `Bearer ${creds.accessToken}`, Accept: "application/json" },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { valid: false, error: `Podium API returned ${res.status}: ${text.slice(0, 200)}` };
      }
      const data = await res.json();
      const locations = data.data || data.locations || [];
      const firstLoc = locations[0] as { name?: string } | undefined;
      return { valid: true, accountName: firstLoc?.name || "Podium Account" };
    } catch {
      return { valid: false, error: "Could not connect to Podium API" };
    }
  }

  async discoverFields(creds: Record<string, string>): Promise<FieldSchema[]> {
    const res = await fetch(`${PODIUM_API_BASE}/contacts?limit=5`, {
      headers: { Authorization: `Bearer ${creds.accessToken}`, Accept: "application/json" },
    });

    if (!res.ok) throw new Error(`Podium API error: ${res.status}`);
    const data = await res.json();
    const rawContacts = data.data || data.contacts || [];

    if (rawContacts.length === 0) return getStaticPodiumFields();

    // Flatten all contacts and collect fields with samples
    const flattened = rawContacts.map((c: Record<string, unknown>) => flattenForDiscovery(c));
    const fieldMap = new Map<string, unknown[]>();
    for (const contact of flattened) {
      for (const [key, value] of Object.entries(contact)) {
        if (!fieldMap.has(key)) fieldMap.set(key, []);
        if (value != null && value !== "") fieldMap.get(key)!.push(value);
      }
    }

    const standardKeys = new Set(["name", "email", "phone", "tags"]);
    const fields: FieldSchema[] = [];

    for (const [key, values] of fieldMap) {
      fields.push({
        key,
        label: humanLabel(key),
        type: inferType(values),
        isStandard: standardKeys.has(key),
        sampleValues: values.slice(0, 3).map((v) => String(v).slice(0, 150)),
      });
    }

    // Raw sample for reference
    fields.push({
      key: "_samplePayload",
      label: "Raw Podium Contact (for reference)",
      type: "text",
      isStandard: false,
      sampleValues: [JSON.stringify(rawContacts[0], null, 2)],
    });

    return fields;
  }

  getDefaultFieldMapping(): FieldMapping[] {
    return [
      { sourceField: "name", targetField: "name", targetType: "standard" },
      { sourceField: "email", targetField: "email", targetType: "standard" },
      { sourceField: "phone", targetField: "phone", targetType: "standard" },
      { sourceField: "tags", targetField: "tags", targetType: "standard" },
    ];
  }

  async *fetchContacts(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalContact[], void, unknown> {
    let cursor: string | undefined;
    do {
      const url = new URL(`${PODIUM_API_BASE}/contacts`);
      url.searchParams.set("limit", "100");
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${creds.accessToken}`, Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Podium contacts API error: ${res.status}`);
      const data = await res.json();
      const contacts = data.data || data.contacts || [];
      if (contacts.length === 0) break;

      yield contacts.map((c: Record<string, unknown>) => mapPodiumContact(c));
      cursor = data.metadata?.cursor || data.nextCursor;
    } while (cursor);
  }

  /**
   * Fetch conversations for a specific contact.
   * 1. GET /contacts/{uid} → contact has conversations[].uid
   * 2. For each conversation uid, GET /conversations/{uid} to fetch messages
   */
  async fetchConversationsForContact(
    creds: Record<string, string>,
    contactSourceId: string
  ): Promise<UniversalConversation[]> {
    const headers = { Authorization: `Bearer ${creds.accessToken}`, Accept: "application/json" };

    // Step 1: GET /contacts/{uid} → read conversations[].uid
    const contactUrl = `${PODIUM_API_BASE}/contacts/${contactSourceId}`;
    console.log(`[Podium] Fetching contact convos: GET ${contactUrl}`);
    const contactRes = await fetch(contactUrl, { headers });
    if (!contactRes.ok) {
      const errBody = await contactRes.text().catch(() => "");
      console.error(`[Podium] Contact fetch failed: ${contactRes.status} ${errBody.slice(0, 200)}`);
      if (contactRes.status === 404) return [];
      throw new Error(`Podium contact fetch error: ${contactRes.status}`);
    }

    const contactData = await contactRes.json();
    const contact = contactData.data || contactData;
    const convRefs = (contact.conversations || []) as { uid: string }[];

    console.log(`[Podium] Contact ${contactSourceId}: ${convRefs.length} conversations found (uids: ${convRefs.map(r => r.uid).join(", ")})`);

    if (convRefs.length === 0) return [];

    // Step 2: For each conversation uid, GET /conversations/{uid}/messages
    const results: UniversalConversation[] = [];

    for (let i = 0; i < convRefs.length; i += 5) {
      const chunk = convRefs.slice(i, i + 5);
      const batch = await Promise.all(
        chunk.map(async (ref) => {
          console.log(`[Podium] Fetching messages: GET /conversations/${ref.uid}/messages`);
          const messages = await fetchAllMessages(creds.accessToken, ref.uid);
          console.log(`[Podium] Conversation ${ref.uid}: ${messages.length} messages`);
          if (messages.length === 0) return null;
          return {
            sourceId: ref.uid,
            contactSourceId,
            channel: "sms" as const as UniversalConversation["channel"],
            messages,
          } satisfies UniversalConversation;
        })
      );
      for (const r of batch) { if (r) results.push(r); }
    }

    return results;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Fetch ALL messages for a conversation, paginating through all pages.
 * Returns messages sorted oldest-first.
 */
async function fetchAllMessages(
  accessToken: string,
  conversationUid: string
): Promise<UniversalMessage[]> {
  const allMessages: UniversalMessage[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(`${PODIUM_API_BASE}/conversations/${conversationUid}/messages`);
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[Podium] Messages API error for conversation ${conversationUid}: ${res.status} ${body.slice(0, 300)}`);
      break;
    }

    const data = await res.json();
    const messages = data.data || [];
    if (messages.length === 0) break;

    for (const m of messages as Record<string, unknown>[]) {
      const body = resolveMessageBody(m);
      if (!body) continue;

      allMessages.push({
        sourceId: String(m.uid || m.id),
        direction: resolveDirection(m),
        body,
        timestamp: new Date(String(m.createdAt || m.sentAt || 0)),
      });
    }

    cursor = (data.metadata as Record<string, unknown>)?.cursor as string | undefined
      || data.nextCursor as string | undefined;
  } while (cursor);

  // Sort oldest first
  allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return allMessages;
}

/**
 * Determine message direction from Podium's nested structure.
 * Checks items[].sourceType, sourceType, deliveryStatus, senderUid.
 */
function resolveDirection(msg: Record<string, unknown>): "inbound" | "outbound" {
  const items = (msg.items || []) as Record<string, unknown>[];
  const iSrc = String(items[0]?.sourceType || "").toLowerCase();
  const tSrc = String(msg.sourceType || "").toLowerCase();
  const dlv = String(items[0]?.deliveryStatus || "").toLowerCase();

  if (iSrc === "inbound" || tSrc === "inbound" || dlv === "received") return "inbound";
  if (iSrc === "outbound" || tSrc === "outbound" || dlv === "sent") return "outbound";
  if (msg.senderUid === null || msg.senderUid === undefined) return "inbound";
  return "outbound";
}

/**
 * Extract readable message body from Podium's complex message structure.
 * Handles: text, review requests, payment requests, voicemails, attachments, emails.
 */
function resolveMessageBody(msg: Record<string, unknown>): string {
  const items = (msg.items || []) as Record<string, unknown>[];
  const itemTypes = items.map((i) => String(i.type || "").toLowerCase());
  const msgType = String(msg.type || "").toLowerCase();

  // Review invitations
  if (
    itemTypes.includes("messenger_review_invitation") ||
    itemTypes.includes("review_invitation") ||
    msgType === "review_invitation"
  ) {
    return "[Review request sent]";
  }

  // Payment requests
  const payItem = items.find(
    (i) =>
      String(i.sendBody || "").toLowerCase().includes("pay.podium") ||
      String(i.sendBody || "").toLowerCase().includes("/pay/")
  );
  if (payItem) {
    const amt = String(payItem.sendBody || "").trim();
    return amt ? `[Payment request sent] ${amt}` : "[Payment request sent]";
  }

  // Voice / call messages
  const isVoice =
    itemTypes.some((t) => ["call", "voicemail", "voice_message", "phone_call"].includes(t)) ||
    ["call", "voicemail", "voice_message", "phone_call"].includes(msgType);
  if (isVoice) {
    const d = msg.duration || items[0]?.duration;
    return d ? `[Voicemail / Call — ${d}s]` : "[Voicemail / Call]";
  }

  // Collect attachments
  const attachLines: string[] = [];
  const attachItems = items.filter(
    (i) =>
      String(i.type || "").toLowerCase() === "attachment" ||
      String(i.attachmentUrl || "") !== "" ||
      String(i.attachmentContentType || "") !== ""
  );
  const topUrl = String(msg.attachmentUrl || "");

  for (const ai of attachItems) {
    const url = String(ai.attachmentUrl || "");
    const ct = String(ai.attachmentContentType || "").toLowerCase();
    if (ct.startsWith("image/")) attachLines.push(url ? `[Image — ${url}]` : "[Image]");
    else if (ct.startsWith("video/")) attachLines.push(url ? `[Video — ${url}]` : "[Video]");
    else if (ct.includes("pdf")) attachLines.push(url ? `[PDF — ${url}]` : "[PDF]");
    else attachLines.push(url ? `[File — ${url}]` : "[File]");
  }
  if (attachItems.length === 0 && topUrl) {
    attachLines.push(`[Attachment — ${topUrl}]`);
  }

  // Text content
  const parts: string[] = [];

  // Email subject
  const subj = String(msg.subject || items[0]?.subject || "");
  if (subj && (msgType === "email" || String(msg.channel || "").toLowerCase().includes("email"))) {
    parts.push(`[Subject: ${subj}]`);
  }

  const topBody = String(msg.body || "").trim();
  if (topBody) parts.push(topBody);

  for (const item of items) {
    const sub = String(item.body || "").trim();
    const send = String(item.sendBody || "").trim();
    if (!topBody && sub && !parts.includes(sub)) parts.push(sub);
    if (send && send !== "null" && !parts.includes(send)) parts.push(send);
  }

  return [...parts, ...attachLines].join("\n").trim();
}

/**
 * Flatten a raw Podium contact for field DISCOVERY.
 * Extracts each attribute as its own field, handles channels/phoneNumbers/emails properly.
 */
function flattenForDiscovery(raw: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (SKIP_FIELDS.has(key)) continue;

    if (key === "name" && value) {
      flat.name = String(value);
    } else if (key === "emails" && Array.isArray(value)) {
      // emails can be array of strings or objects
      if (value.length > 0) {
        const first = value[0];
        flat.email = typeof first === "string" ? first : (first as Record<string, unknown>)?.value || (first as Record<string, unknown>)?.address || "";
      }
    } else if (key === "phoneNumbers" && Array.isArray(value)) {
      // phoneNumbers is array of strings like ["+61423685185"]
      if (value.length > 0) {
        flat.phone = typeof value[0] === "string" ? value[0] : String((value[0] as Record<string, unknown>)?.value || value[0]);
      }
    } else if (key === "channels" && Array.isArray(value)) {
      // channels has type + identifier — extract phone/email if not already set
      for (const ch of value as { type?: string; identifier?: string }[]) {
        if (ch.type === "PHONE" && ch.identifier && !flat.phone) {
          flat.phone = ch.identifier;
        } else if (ch.type === "EMAIL" && ch.identifier && !flat.email) {
          flat.email = ch.identifier;
        }
      }
    } else if (key === "address" && typeof value === "string") {
      flat.address = value;
    } else if (key === "address" && typeof value === "object" && value !== null) {
      const addr = value as Record<string, unknown>;
      flat.address = [addr.streetAddress, addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ");
    } else if (key === "tags" && Array.isArray(value)) {
      flat.tags = value.join(", ");
    } else if (key === "attributes" && Array.isArray(value)) {
      // Each attribute becomes its own mappable field
      for (const attr of value as { label?: string; value?: unknown; dataType?: string }[]) {
        if (!attr.label) continue;
        const fieldKey = `attr:${attr.label}`;
        flat[fieldKey] = attr.value != null ? String(attr.value) : null;
      }
    } else if (typeof value !== "object") {
      // Simple primitive
      flat[key] = value;
    }
  }

  return flat;
}

/**
 * Flatten a raw Podium contact for IMPORT into UniversalContact.
 */
function mapPodiumContact(raw: Record<string, unknown>): UniversalContact {
  const flat = flattenForDiscovery(raw);

  const name = String(flat.name || "");
  const parts = name.split(" ");
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";

  const customFields: Record<string, string | number | boolean> = {};
  const standardKeys = new Set(["name", "email", "phone", "address", "tags"]);

  for (const [key, value] of Object.entries(flat)) {
    if (!standardKeys.has(key) && value != null && value !== "") {
      customFields[key] = typeof value === "object" ? JSON.stringify(value) : (value as string | number | boolean);
    }
  }

  return {
    sourceId: String(raw.uid || (raw as Record<string, unknown>).id),
    firstName,
    lastName,
    email: flat.email ? String(flat.email) : undefined,
    phone: flat.phone ? String(flat.phone) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
    customFields,
    source: "podium",
    rawData: raw,
  };
}

function mapChannel(channel: string): "sms" | "email" | "chat" | "phone" | "other" {
  const lower = channel.toLowerCase();
  if (lower.includes("sms") || lower.includes("text")) return "sms";
  if (lower.includes("email")) return "email";
  if (lower.includes("chat") || lower.includes("webchat")) return "chat";
  if (lower.includes("phone") || lower.includes("call")) return "phone";
  return "other";
}

function humanLabel(key: string): string {
  // attr:Birthday → Birthday, attr:Opportunity Value → Opportunity Value
  if (key.startsWith("attr:")) return key.slice(5);
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function inferType(values: unknown[]): FieldSchema["type"] {
  if (values.length === 0) return "text";
  const sample = values[0];
  if (typeof sample === "boolean") return "boolean";
  if (typeof sample === "number") return "number";
  const str = String(sample);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return "date";
  if (/^https?:\/\//.test(str)) return "url";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return "email";
  if (/^\+?[\d\s()-]{7,}$/.test(str)) return "phone";
  return "text";
}

function getStaticPodiumFields(): FieldSchema[] {
  return [
    { key: "name", label: "Name", type: "text", isStandard: true, sampleValues: ["John Smith"] },
    { key: "email", label: "Email", type: "email", isStandard: true, sampleValues: ["john@example.com"] },
    { key: "phone", label: "Phone", type: "phone", isStandard: true, sampleValues: ["+1234567890"] },
    { key: "tags", label: "Tags", type: "text", isStandard: true, sampleValues: ["lead, new"] },
    { key: "attr:Birthday", label: "Birthday", type: "date", isStandard: false, sampleValues: [] },
    { key: "attr:Contact Source", label: "Contact Source", type: "text", isStandard: false, sampleValues: [] },
    { key: "attr:Opportunity Value", label: "Opportunity Value", type: "number", isStandard: false, sampleValues: [] },
  ];
}
