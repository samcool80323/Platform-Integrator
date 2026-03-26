import type { PlatformConnector, AuthConfig, ConnectorCapabilities } from "../types";
import type {
  FieldSchema,
  FieldMapping,
  UniversalContact,
  UniversalConversation,
  UniversalMessage,
} from "../../universal-model/types";

const PODIUM_API_BASE = "https://api.podium.com/v4";

// Fields that are internal Podium routing data — not useful for mapping to GHL
const SKIP_FIELDS = new Set([
  "id", "uid", "channels", "locations", "conversations", "createdAt", "updatedAt",
]);

const CREDENTIAL_GUIDE = `
## How to connect Podium

Podium uses a secure login (OAuth 2.0). You do NOT need to copy any keys — just click "Connect with Podium" and log in.

**But first**, you need to register your Platform Integrator as an app in Podium. Here's exactly how:

---

### Step 1 — Log in to Podium
1. Open your browser and go to **https://app.podium.com**
2. Sign in with your Podium username and password
3. You must be a **Podium Admin** — if you're not, ask your account owner

---

### Step 2 — Go to Developer Settings
1. Click your **profile picture or company name** in the top-right corner
2. Select **"Settings"** from the dropdown
3. In the left sidebar, scroll down and click **"Integrations"**
4. Then click **"API"** or **"Developer"**

---

### Step 3 — Create a New App
1. Click **"Create New Application"** (or **"+ New App"**)
2. Fill in the form:
   - **App Name:** Platform Integrator
   - **Redirect URI:** copy the redirect URI shown in your Platform Integrator Settings page (under Podium setup)
3. Click **"Save"** or **"Create"**

---

### Step 4 — Copy your Client ID and Client Secret
After saving, Podium will show you:
- **Client ID** — looks like: \`abc123def456...\`
- **Client Secret** — looks like: \`xyz789...\` (treat this like a password!)

Go to **Platform Integrator Settings → Connectors** and enter these two values for Podium.

---

### Step 5 — Connect!
Come back here and click **"Connect with Podium"**. You'll be taken to the Podium login page. Sign in and approve the connection.

> **Stuck?** Make sure the Redirect URI is copied exactly — even a single extra space will break it.
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
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const res = await fetch(`${PODIUM_API_BASE}/locations`, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          Accept: "application/json",
        },
      });
      if (res.ok) return { valid: true };
      const text = await res.text().catch(() => "");
      return { valid: false, error: `Podium API returned ${res.status}: ${text.slice(0, 200)}` };
    } catch {
      return { valid: false, error: "Could not connect to Podium API" };
    }
  }

  async discoverFields(creds: Record<string, string>): Promise<FieldSchema[]> {
    const res = await fetch(`${PODIUM_API_BASE}/contacts?limit=5`, {
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) throw new Error(`Podium API error: ${res.status}`);
    const data = await res.json();
    const rawContacts = data.data || data.contacts || [];

    if (rawContacts.length === 0) {
      // Return basic known Podium fields even if no contacts exist yet
      return getStaticPodiumFields();
    }

    // Flatten each contact to extract real values from nested objects
    const flattened = rawContacts.map((c: Record<string, unknown>) => flattenPodiumContact(c));

    // Collect unique keys with sample values
    const fieldMap = new Map<string, unknown[]>();
    for (const contact of flattened) {
      for (const [key, value] of Object.entries(contact)) {
        if (!fieldMap.has(key)) fieldMap.set(key, []);
        if (value != null && value !== "") fieldMap.get(key)!.push(value);
      }
    }

    const fields: FieldSchema[] = [];
    const standardKeys = new Set(["name", "firstName", "lastName", "email", "phone", "address", "tags", "companyName"]);

    for (const [key, values] of fieldMap) {
      fields.push({
        key,
        label: humanLabel(key),
        type: inferType(values),
        isStandard: standardKeys.has(key),
        sampleValues: values.slice(0, 3).map((v) => String(v).slice(0, 120)),
      });
    }

    // Also stash the first raw contact as a special _samplePayload field for the UI
    fields.push({
      key: "_samplePayload",
      label: "Raw Podium Contact (for reference)",
      type: "text",
      isStandard: false,
      sampleValues: [JSON.stringify(rawContacts[0], null, 2).slice(0, 500)],
    });

    return fields;
  }

  getDefaultFieldMapping(): FieldMapping[] {
    return [
      { sourceField: "name", targetField: "firstName", targetType: "standard" },
      { sourceField: "email", targetField: "email", targetType: "standard" },
      { sourceField: "phone", targetField: "phone", targetType: "standard" },
      { sourceField: "address", targetField: "address1", targetType: "standard" },
      { sourceField: "companyName", targetField: "companyName", targetType: "standard" },
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
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          Accept: "application/json",
        },
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
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) throw new Error(`Podium conversations API error: ${res.status}`);
      const data = await res.json();
      const conversations = data.data || [];

      if (conversations.length === 0) break;

      const mapped: UniversalConversation[] = [];
      for (const conv of conversations) {
        const msgRes = await fetch(
          `${PODIUM_API_BASE}/conversations/${conv.uid}/messages?limit=100`,
          {
            headers: {
              Authorization: `Bearer ${creds.accessToken}`,
              Accept: "application/json",
            },
          }
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
 * Flatten a raw Podium contact into simple key-value pairs.
 * Extracts real values from nested arrays/objects like emails, phoneNumbers, organization.
 */
function flattenPodiumContact(raw: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (SKIP_FIELDS.has(key)) continue;

    if (key === "emails" && Array.isArray(value)) {
      // Extract first email address string
      const emails = value as { value?: string; address?: string }[];
      flat.email = emails[0]?.value || emails[0]?.address || "";
    } else if (key === "phoneNumbers" && Array.isArray(value)) {
      // Extract first phone number string
      const phones = value as { value?: string; number?: string }[];
      flat.phone = phones[0]?.value || phones[0]?.number || "";
    } else if (key === "organization" && typeof value === "object" && value !== null) {
      const org = value as { name?: string; uid?: string };
      flat.companyName = org.name || "";
    } else if (key === "address" && typeof value === "object" && value !== null) {
      const addr = value as { streetAddress?: string; city?: string; state?: string; postalCode?: string };
      flat.address = [addr.streetAddress, addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ");
    } else if (key === "attributes" && Array.isArray(value)) {
      // Flatten attributes into individual fields prefixed with "attr_"
      for (const attr of value as { key?: string; value?: string; label?: string }[]) {
        const attrKey = attr.key || attr.label;
        if (attrKey && attr.value) {
          flat[`attr_${attrKey}`] = attr.value;
        }
      }
    } else if (typeof value === "object" && value !== null) {
      // For any other nested object, try to extract a meaningful string
      const obj = value as Record<string, unknown>;
      if (obj.name) flat[key] = String(obj.name);
      else if (obj.value) flat[key] = String(obj.value);
      // else skip — it's structural data not useful for contact fields
    } else {
      // Primitive value — keep as-is
      flat[key] = value;
    }
  }

  return flat;
}

function mapPodiumContact(raw: Record<string, unknown>): UniversalContact {
  const flat = flattenPodiumContact(raw);

  const name = String(flat.name || "");
  const parts = name.split(" ");
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";

  const customFields: Record<string, string | number | boolean> = {};
  const standardKeys = new Set(["name", "email", "phone", "address", "companyName", "tags"]);

  for (const [key, value] of Object.entries(flat)) {
    if (!standardKeys.has(key) && value != null && value !== "") {
      customFields[key] = typeof value === "object" ? JSON.stringify(value) : (value as string | number | boolean);
    }
  }

  return {
    sourceId: String(raw.uid || raw.id),
    firstName,
    lastName,
    email: flat.email ? String(flat.email) : undefined,
    phone: flat.phone ? String(flat.phone) : undefined,
    companyName: flat.companyName ? String(flat.companyName) : undefined,
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
  return key
    .replace(/^attr_/, "")
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

/** Fallback fields if no contacts exist yet */
function getStaticPodiumFields(): FieldSchema[] {
  return [
    { key: "name", label: "Name", type: "text", isStandard: true, sampleValues: ["John Smith"] },
    { key: "email", label: "Email", type: "email", isStandard: true, sampleValues: ["john@example.com"] },
    { key: "phone", label: "Phone", type: "phone", isStandard: true, sampleValues: ["+1234567890"] },
    { key: "address", label: "Address", type: "text", isStandard: true, sampleValues: ["123 Main St, City, ST 12345"] },
    { key: "companyName", label: "Company Name", type: "text", isStandard: true, sampleValues: ["Acme Corp"] },
    { key: "tags", label: "Tags", type: "text", isStandard: true, sampleValues: ["lead, new"] },
  ];
}
