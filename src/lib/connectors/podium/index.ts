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
## How to get your Podium API credentials

1. **Log in** to your Podium account at [podium.com](https://podium.com)
2. Navigate to **Settings** → **Integrations** → **API**
3. Click **"Create New Application"**
4. Set the redirect URI to your Platform Integrator callback URL
5. Copy the **Client ID** and **Client Secret**
6. Enter them below to connect

> **Note:** You need admin access to your Podium account to create API credentials.
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
    scopes: ["read", "write"],
    scopeDescriptions: {
      read: "Read contacts, conversations, reviews, and location data",
      write: "Create and update contacts and conversations",
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
      const res = await fetch(`${PODIUM_API_BASE}/organizations`, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          Accept: "application/json",
        },
      });
      if (res.ok) return { valid: true };
      return { valid: false, error: `Podium API returned ${res.status}` };
    } catch (e) {
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
