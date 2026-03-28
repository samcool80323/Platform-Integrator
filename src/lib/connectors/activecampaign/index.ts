import type { PlatformConnector, AuthConfig, ConnectorCapabilities } from "../types";
import type {
  FieldSchema,
  FieldMapping,
  UniversalContact,
  UniversalConversation,
  UniversalMessage,
} from "../../universal-model/types";
import { inferFieldType } from "../base";

const CREDENTIAL_GUIDE = `
## How to get your ActiveCampaign API URL and Key

You need two things: your **API URL** and your **API Key**.

---

### Step 1 — Log in to ActiveCampaign
1. Open your browser and go to **https://www.activecampaign.com**
2. Click **"Log In"** at the top right
3. Enter your email and password

---

### Step 2 — Go to Settings
1. In the left sidebar, click **"Settings"** (gear icon ⚙️) near the bottom
2. The Settings page will open

---

### Step 3 — Find your API credentials
1. In the Settings menu, click **"Developer"**
   - If you don't see "Developer", look for **"API Access"** or check under **"Account Settings"**
2. You'll see two things on this page:
   - **API URL** — looks like: \`https://youraccountname.api-us1.com\`
   - **API Key** — a long random string of letters and numbers

---

### Step 4 — Copy both values
1. Copy the **API URL** — select all the text and copy it
2. Copy the **API Key** — click "Copy" or select and copy it
3. Paste each one into the fields below

> **Tip:** Your API URL is unique to your account. It usually contains your account name in it.

> **Don't have Developer access?** You need to be an **Admin** in ActiveCampaign. Ask your account owner to check the Developer page for you.
`;

export class ActiveCampaignConnector implements PlatformConnector {
  id = "activecampaign";
  name = "ActiveCampaign";
  logo = "/logos/activecampaign.svg";
  description = "Import contacts and tags from ActiveCampaign";

  authConfig: AuthConfig = {
    type: "api_key",
    fields: [
      {
        key: "apiUrl",
        label: "API URL",
        placeholder: "https://youraccountname.api-us1.com",
        secret: false,
        helpText: "Found in Settings → Developer. Include the full URL with https://",
      },
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your ActiveCampaign API key",
        secret: true,
        helpText: "Found on the same Developer page as your API URL",
      },
    ],
  };

  capabilities: ConnectorCapabilities = {
    contacts: true,
    conversations: true,
    opportunities: false,
    appointments: false,
  };

  credentialGuide = CREDENTIAL_GUIDE;

  private getHeaders(creds: Record<string, string>) {
    return {
      "Api-Token": creds.apiKey,
      Accept: "application/json",
    };
  }

  private getBaseUrl(creds: Record<string, string>) {
    return creds.apiUrl.replace(/\/$/, "") + "/api/3";
  }

  async validateCredentials(
    creds: Record<string, string>
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      if (!creds.apiUrl || !creds.apiKey) {
        return { valid: false, error: "Both API URL and API Key are required" };
      }
      const res = await fetch(`${this.getBaseUrl(creds)}/contacts?limit=1`, {
        headers: this.getHeaders(creds),
      });
      if (res.ok) return { valid: true };
      if (res.status === 401) return { valid: false, error: "Invalid API key" };
      return { valid: false, error: `ActiveCampaign API returned ${res.status}` };
    } catch {
      return { valid: false, error: "Could not connect. Check your API URL is correct." };
    }
  }

  async discoverFields(creds: Record<string, string>): Promise<FieldSchema[]> {
    // Fetch custom fields schema
    const res = await fetch(`${this.getBaseUrl(creds)}/fields`, {
      headers: this.getHeaders(creds),
    });

    const standardFields: FieldSchema[] = [
      { key: "firstName", label: "First Name", type: "text", isStandard: true, sampleValues: [] },
      { key: "lastName", label: "Last Name", type: "text", isStandard: true, sampleValues: [] },
      { key: "email", label: "Email", type: "email", isStandard: true, sampleValues: [] },
      { key: "phone", label: "Phone", type: "phone", isStandard: true, sampleValues: [] },
    ];

    if (!res.ok) return standardFields;

    const data = await res.json();
    const customFieldDefs = data.fields || [];

    const customFields: FieldSchema[] = customFieldDefs.map(
      (f: { perstag: string; title: string; type: string }) => ({
        key: `custom_${f.perstag}`,
        label: f.title,
        type: mapAcType(f.type),
        isStandard: false,
        sampleValues: [],
      })
    );

    return [...standardFields, ...customFields];
  }

  getDefaultFieldMapping(): FieldMapping[] {
    return [
      { sourceField: "firstName", targetField: "firstName", targetType: "standard" },
      { sourceField: "lastName", targetField: "lastName", targetType: "standard" },
      { sourceField: "email", targetField: "email", targetType: "standard" },
      { sourceField: "phone", targetField: "phone", targetType: "standard" },
    ];
  }

  async *fetchContacts(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalContact[], void, unknown> {
    let offset = 0;
    const limit = 100;

    while (true) {
      const res = await fetch(
        `${this.getBaseUrl(creds)}/contacts?limit=${limit}&offset=${offset}&include=fieldValues`,
        { headers: this.getHeaders(creds) }
      );

      if (!res.ok) throw new Error(`ActiveCampaign API error: ${res.status}`);
      const data = await res.json();
      const contacts = data.contacts || [];

      if (contacts.length === 0) break;

      yield contacts.map((c: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        fieldValues?: { field: string; value: string }[];
      }) => {
        const customFields: Record<string, string | number | boolean> = {};
        for (const fv of c.fieldValues || []) {
          if (fv.value) customFields[`custom_${fv.field}`] = fv.value;
        }

        return {
          sourceId: c.id,
          firstName: c.firstName || undefined,
          lastName: c.lastName || undefined,
          email: c.email || undefined,
          phone: c.phone || undefined,
          customFields,
          source: "activecampaign",
          rawData: c,
        } as UniversalContact;
      });

      if (contacts.length < limit) break;
      offset += limit;
    }
  }

  async fetchConversationsForContact(
    creds: Record<string, string>,
    contactSourceId: string
  ): Promise<UniversalConversation[]> {
    const messages: UniversalMessage[] = [];

    try {
      let offset = 0;
      const limit = 100;

      while (true) {
        const res = await fetch(
          `${this.getBaseUrl(creds)}/contacts/${contactSourceId}/notes?limit=${limit}&offset=${offset}`,
          { headers: this.getHeaders(creds) }
        );

        if (!res.ok) break;
        const data = await res.json();
        const notes = data.notes || [];

        if (notes.length === 0) break;

        for (const note of notes) {
          const body = (note.note || "").replace(/<[^>]*>/g, "").trim();
          if (!body) continue;

          messages.push({
            sourceId: String(note.id),
            direction: "outbound",
            body: `[Note] ${body}`,
            timestamp: new Date(note.cdate || note.mdate || Date.now()),
          });
        }

        if (notes.length < limit) break;
        offset += limit;
      }
    } catch {
      // Notes fetch failed
    }

    if (messages.length === 0) return [];

    return [
      {
        sourceId: `activecampaign-contact-${contactSourceId}`,
        contactSourceId,
        channel: "other" as const,
        messages,
      },
    ];
  }
}

function mapAcType(type: string): FieldSchema["type"] {
  const map: Record<string, FieldSchema["type"]> = {
    text: "text",
    textarea: "text",
    date: "date",
    dropdown: "select",
    radio: "select",
    checkbox: "boolean",
    hidden: "text",
    currency: "number",
    number: "number",
  };
  return map[type] || "text";
}

void inferFieldType;
