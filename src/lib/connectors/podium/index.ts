import type { PlatformConnector, AuthConfig, ConnectorCapabilities } from "../types";
import type {
  FieldSchema,
  FieldMapping,
  UniversalContact,
  UniversalConversation,
  UniversalMessage,
} from "../../universal-model/types";
import { autoMapFields, inferFieldType } from "../base";

const PODIUM_API_BASE = "https://api.podium.com/v4";

const CREDENTIAL_GUIDE = `
## How to connect Podium

Podium uses a secure login (OAuth 2.0). You do NOT need to copy any keys — just click "Connect with Podium" and log in.

**But first**, you need to register your Platform Integrator as an app in Podium. Here's exactly how:

---

### Step 1 — Log in to Podium
1. Open your browser and go to **https://app.podium.com**
2. Sign in with your Podium username and password
3. ⚠️ You must be a **Podium Admin** — if you're not, ask your account owner

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
    // Fetch a sample of contacts to discover available fields
    const res = await fetch(
      `${PODIUM_API_BASE}/contacts?limit=5`,
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) throw new Error(`Podium API error: ${res.status}`);
    const data = await res.json();
    const contacts = data.data || data.contacts || [];

    // Collect all unique keys across sample contacts
    const fieldMap = new Map<string, unknown[]>();
    for (const contact of contacts) {
      for (const [key, value] of Object.entries(contact)) {
        if (key === "id" || key === "uid") continue;
        if (!fieldMap.has(key)) fieldMap.set(key, []);
        fieldMap.get(key)!.push(value);
      }
    }

    const fields: FieldSchema[] = [];
    const standardKeys = new Set([
      "name",
      "firstName",
      "lastName",
      "email",
      "phone",
      "phoneNumber",
    ]);

    for (const [key, values] of fieldMap) {
      fields.push({
        key,
        label: key
          .replace(/([A-Z])/g, " $1")
          .replace(/[_-]/g, " ")
          .trim(),
        type: inferFieldType(values),
        isStandard: standardKeys.has(key),
        sampleValues: values
          .filter((v) => v != null)
          .slice(0, 3)
          .map(String),
      });
    }

    return fields;
  }

  getDefaultFieldMapping(): FieldMapping[] {
    return [
      { sourceField: "name", targetField: "firstName", targetType: "standard", transform: "none" },
      { sourceField: "email", targetField: "email", targetType: "standard" },
      { sourceField: "phoneNumber", targetField: "phone", targetType: "standard" },
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

      yield contacts.map((c: Record<string, unknown>) =>
        mapPodiumContact(c)
      );

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
        // Fetch messages for each conversation
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

function mapPodiumContact(raw: Record<string, unknown>): UniversalContact {
  const name = String(raw.name || "");
  const parts = name.split(" ");
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";

  const customFields: Record<string, string | number | boolean> = {};
  const standardKeys = new Set([
    "id", "uid", "name", "email", "phoneNumber", "phone",
    "firstName", "lastName", "tags", "createdAt", "updatedAt",
  ]);

  for (const [key, value] of Object.entries(raw)) {
    if (!standardKeys.has(key) && value != null) {
      customFields[key] = typeof value === "object" ? JSON.stringify(value) : (value as string | number | boolean);
    }
  }

  return {
    sourceId: String(raw.uid || raw.id),
    firstName: String(raw.firstName || firstName),
    lastName: String(raw.lastName || lastName),
    email: raw.email ? String(raw.email) : undefined,
    phone: raw.phoneNumber ? String(raw.phoneNumber) : raw.phone ? String(raw.phone) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
    customFields,
    source: "podium",
    rawData: raw,
  };
}

function mapChannel(
  channel: string
): "sms" | "email" | "chat" | "phone" | "other" {
  const lower = channel.toLowerCase();
  if (lower.includes("sms") || lower.includes("text")) return "sms";
  if (lower.includes("email")) return "email";
  if (lower.includes("chat") || lower.includes("webchat")) return "chat";
  if (lower.includes("phone") || lower.includes("call")) return "phone";
  return "other";
}
