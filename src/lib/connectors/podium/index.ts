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

  async *fetchConversations(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalConversation[], void, unknown> {
    let cursor: string | undefined;
    do {
      const url = new URL(`${PODIUM_API_BASE}/conversations`);
      url.searchParams.set("limit", "50");
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${creds.accessToken}`, Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Podium conversations API error: ${res.status}`);
      const data = await res.json();
      const conversations = data.data || [];
      if (conversations.length === 0) break;

      const mapped: UniversalConversation[] = [];
      for (const conv of conversations) {
        const msgRes = await fetch(
          `${PODIUM_API_BASE}/conversations/${conv.uid}/messages?limit=100`,
          { headers: { Authorization: `Bearer ${creds.accessToken}`, Accept: "application/json" } }
        );
        const msgData = msgRes.ok ? await msgRes.json() : { data: [] };
        const messages: UniversalMessage[] = (msgData.data || []).map(
          (m: Record<string, unknown>) => ({
            sourceId: String(m.uid || m.id),
            direction: m.direction === "outbound" ? "outbound" as const : "inbound" as const,
            body: String(m.body || m.text || ""),
            timestamp: new Date(String(m.createdAt || m.sentAt)),
          })
        );
        mapped.push({
          sourceId: String(conv.uid || conv.id),
          contactSourceId: String(conv.contactUid || conv.contactId || ""),
          channel: mapChannel(String(conv.channel || "sms")),
          messages,
        });
      }
      yield mapped;
      cursor = data.metadata?.cursor || data.nextCursor;
    } while (cursor);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

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
