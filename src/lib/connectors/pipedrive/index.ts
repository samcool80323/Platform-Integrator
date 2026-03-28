import type { PlatformConnector, AuthConfig, ConnectorCapabilities } from "../types";
import type {
  FieldSchema,
  FieldMapping,
  UniversalContact,
  UniversalConversation,
  UniversalMessage,
  UniversalOpportunity,
} from "../../universal-model/types";
import { inferFieldType } from "../base";

const PIPEDRIVE_API_BASE = "https://api.pipedrive.com/v1";

const CREDENTIAL_GUIDE = `
## How to get your Pipedrive API Token

---

### Step 1 — Log in to Pipedrive
1. Open your browser and go to **https://app.pipedrive.com**
2. Sign in with your email and password

---

### Step 2 — Go to Personal Preferences
1. Click your **profile picture** in the top right corner of the screen
   - It shows your initials or your photo
2. A dropdown menu appears — click **"Personal preferences"**

---

### Step 3 — Find your API Token
1. The Personal preferences page opens
2. Click on the **"API"** tab at the top of the page
3. You will see your **"Your personal API token"**
4. Click the **"Copy"** button next to it

---

### Step 4 — Paste it below
1. Paste the API token into the **"API Token"** field below
2. It looks like: \`abc123def456abc123def456abc123de\` (32 characters)

> **Note:** Each person in Pipedrive has their own API token. Use the account owner's token for full access.

> **Tip:** You can also find the token at **Settings → Personal → API** in the left sidebar.
`;

export class PipedriveConnector implements PlatformConnector {
  id = "pipedrive";
  name = "Pipedrive";
  logo = "/logos/pipedrive.svg";
  description = "Import persons, organizations, and deals from Pipedrive CRM";

  authConfig: AuthConfig = {
    type: "api_key",
    fields: [
      {
        key: "apiToken",
        label: "API Token",
        placeholder: "Enter your Pipedrive API token",
        secret: true,
        helpText: "Found in Personal preferences → API tab",
      },
    ],
  };

  capabilities: ConnectorCapabilities = {
    contacts: true,
    conversations: true,
    opportunities: true,
    appointments: false,
  };

  credentialGuide = CREDENTIAL_GUIDE;

  private buildUrl(path: string, creds: Record<string, string>, params: Record<string, string> = {}) {
    const url = new URL(`${PIPEDRIVE_API_BASE}${path}`);
    url.searchParams.set("api_token", creds.apiToken);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    return url.toString();
  }

  async validateCredentials(
    creds: Record<string, string>
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const res = await fetch(this.buildUrl("/users/me", creds));
      if (res.ok) return { valid: true };
      if (res.status === 401) return { valid: false, error: "Invalid API token" };
      return { valid: false, error: `Pipedrive API returned ${res.status}` };
    } catch {
      return { valid: false, error: "Could not connect to Pipedrive API" };
    }
  }

  async discoverFields(creds: Record<string, string>): Promise<FieldSchema[]> {
    const res = await fetch(this.buildUrl("/personFields", creds));
    if (!res.ok) throw new Error(`Pipedrive API error: ${res.status}`);
    const data = await res.json();
    const fields = data.data || [];

    const standardKeys = new Set(["name", "email", "phone", "org_id"]);

    return fields.map((f: { key: string; name: string; field_type: string }) => ({
      key: f.key,
      label: f.name,
      type: mapPipedriveType(f.field_type),
      isStandard: standardKeys.has(f.key),
      sampleValues: [],
    }));
  }

  getDefaultFieldMapping(): FieldMapping[] {
    return [
      { sourceField: "name", targetField: "firstName", targetType: "standard" },
      { sourceField: "email", targetField: "email", targetType: "standard" },
      { sourceField: "phone", targetField: "phone", targetType: "standard" },
    ];
  }

  async *fetchContacts(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalContact[], void, unknown> {
    let start = 0;
    const limit = 100;

    while (true) {
      const res = await fetch(
        this.buildUrl("/persons", creds, { limit: String(limit), start: String(start) })
      );

      if (!res.ok) throw new Error(`Pipedrive persons API error: ${res.status}`);
      const data = await res.json();
      const persons = data.data || [];

      if (!persons || persons.length === 0) break;

      yield persons.map((p: {
        id: number;
        name: string;
        email: { value: string; primary: boolean }[];
        phone: { value: string; primary: boolean }[];
        [key: string]: unknown;
      }) => {
        const primaryEmail = p.email?.find((e) => e.primary)?.value || p.email?.[0]?.value;
        const primaryPhone = p.phone?.find((ph) => ph.primary)?.value || p.phone?.[0]?.value;
        const nameParts = (p.name || "").split(" ");

        const standardKeys = new Set(["id", "name", "email", "phone", "org_id", "owner_id", "add_time", "update_time"]);
        const customFields: Record<string, string | number | boolean> = {};
        for (const [key, value] of Object.entries(p)) {
          if (!standardKeys.has(key) && value != null && typeof value !== "object") {
            customFields[key] = value as string | number | boolean;
          }
        }

        return {
          sourceId: String(p.id),
          firstName: nameParts[0] || "",
          lastName: nameParts.slice(1).join(" ") || "",
          email: primaryEmail,
          phone: primaryPhone,
          customFields,
          source: "pipedrive",
          rawData: p,
        } as UniversalContact;
      });

      if (!data.additional_data?.pagination?.more_items_in_collection) break;
      start += limit;
    }
  }

  async *fetchOpportunities(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalOpportunity[], void, unknown> {
    let start = 0;
    const limit = 100;

    while (true) {
      const res = await fetch(
        this.buildUrl("/deals", creds, { limit: String(limit), start: String(start) })
      );

      if (!res.ok) throw new Error(`Pipedrive deals API error: ${res.status}`);
      const data = await res.json();
      const deals = data.data || [];

      if (!deals || deals.length === 0) break;

      yield deals.map((d: {
        id: number;
        title: string;
        value: number;
        currency: string;
        status: string;
        person_id?: { value: number };
        stage_id: number;
        close_time?: string;
      }) => ({
        sourceId: String(d.id),
        contactSourceId: d.person_id ? String(d.person_id.value) : undefined,
        title: d.title,
        value: d.value,
        currency: d.currency,
        status: mapDealStatus(d.status),
        stage: String(d.stage_id),
        closeDate: d.close_time ? new Date(d.close_time) : undefined,
      }));

      if (!data.additional_data?.pagination?.more_items_in_collection) break;
      start += limit;
    }
  }

  async fetchConversationsForContact(
    creds: Record<string, string>,
    contactSourceId: string
  ): Promise<UniversalConversation[]> {
    const messages: UniversalMessage[] = [];

    // Fetch activities for this person
    try {
      let start = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const res = await fetch(
          this.buildUrl(`/persons/${contactSourceId}/activities`, creds, {
            limit: String(limit),
            start: String(start),
          })
        );

        if (!res.ok) break;
        const data = await res.json();
        const activities = data.data || [];

        for (const act of activities) {
          const parts: string[] = [];
          if (act.type) parts.push(`[${act.type}]`);
          if (act.subject) parts.push(act.subject);
          if (act.note) parts.push(act.note.replace(/<[^>]*>/g, "").trim());
          if (act.public_description) parts.push(act.public_description);

          const body = parts.join(" — ").trim();
          if (!body) continue;

          messages.push({
            sourceId: `activity-${act.id}`,
            direction: "outbound",
            body,
            timestamp: new Date(act.due_date && act.due_time
              ? `${act.due_date}T${act.due_time}`
              : act.add_time || Date.now()),
          });
        }

        hasMore = !!data.additional_data?.pagination?.more_items_in_collection;
        start += limit;
      }
    } catch {
      // Activities fetch failed — continue with notes
    }

    // Fetch notes for this person
    try {
      let start = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const res = await fetch(
          this.buildUrl("/notes", creds, {
            person_id: contactSourceId,
            limit: String(limit),
            start: String(start),
          })
        );

        if (!res.ok) break;
        const data = await res.json();
        const notes = data.data || [];

        for (const note of notes) {
          const body = (note.content || "").replace(/<[^>]*>/g, "").trim();
          if (!body) continue;

          messages.push({
            sourceId: `note-${note.id}`,
            direction: "outbound",
            body: `[Note] ${body}`,
            timestamp: new Date(note.add_time || Date.now()),
          });
        }

        hasMore = !!data.additional_data?.pagination?.more_items_in_collection;
        start += limit;
      }
    } catch {
      // Notes fetch failed — continue
    }

    if (messages.length === 0) return [];

    return [
      {
        sourceId: `pipedrive-person-${contactSourceId}`,
        contactSourceId,
        channel: "other" as const,
        messages,
      },
    ];
  }
}

function mapPipedriveType(type: string): FieldSchema["type"] {
  const map: Record<string, FieldSchema["type"]> = {
    varchar: "text",
    varchar_auto: "text",
    text: "text",
    double: "number",
    monetary: "number",
    date: "date",
    enum: "select",
    set: "select",
    phone: "phone",
    email: "email",
    user: "text",
    org: "text",
    people: "text",
    boolean: "boolean",
  };
  return map[type] || "text";
}

function mapDealStatus(status: string): "open" | "won" | "lost" {
  if (status === "won") return "won";
  if (status === "lost") return "lost";
  return "open";
}

void inferFieldType;
