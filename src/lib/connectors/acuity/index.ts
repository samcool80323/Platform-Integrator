import type { PlatformConnector, AuthConfig, ConnectorCapabilities } from "../types";
import type {
  FieldSchema,
  FieldMapping,
  UniversalContact,
  UniversalAppointment,
} from "../../universal-model/types";

const ACUITY_API_BASE = "https://acuityscheduling.com/api/v1";

const CREDENTIAL_GUIDE = `
## How to get your Acuity Scheduling API credentials

You need two things: your **User ID** and **API Key**.

---

### Step 1 — Log in to Acuity Scheduling
1. Open your browser and go to **https://acuityscheduling.com**
2. Click **"Sign In"** and enter your email and password
3. ⚠️ You need to be the **account owner** or have admin access

---

### Step 2 — Go to API Integrations
1. Once logged in, click **"Business Settings"** in the left sidebar
   - On some versions it may be under your **profile name** at the top right → Settings
2. Scroll down in the left sidebar and look for **"Integrations"**
3. Click **"API"** or **"Integrations"** → then look for **"API Credentials"** or **"Acuity API"**

---

### Step 3 — Find your User ID and API Key
1. On the API page, you will see:
   - **User ID** — a number, e.g. \`12345678\`
   - **API Key** — a long random string of letters and numbers
2. Copy both of them

---

### Step 4 — Enter them below
- Paste your **User ID** into the "User ID" field
- Paste your **API Key** into the "API Key" field

> **Tip:** The API key is labeled "API Key" on the page. Don't confuse it with the API documentation URL shown nearby.

> **Note:** Acuity is now part of Squarespace. If you log in via Squarespace, navigate to: **Squarespace account** → **Acuity Scheduling** → **Business Settings** → **Integrations** → **API**.
`;

export class AcuityConnector implements PlatformConnector {
  id = "acuity";
  name = "Acuity Scheduling";
  logo = "/logos/acuity.svg";
  description = "Import clients and appointments from Acuity Scheduling";

  authConfig: AuthConfig = {
    type: "header_auth",
    fields: [
      {
        key: "userId",
        label: "User ID",
        placeholder: "e.g. 12345678",
        secret: false,
        helpText: "Found in Business Settings → Integrations → API",
      },
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Acuity API key",
        secret: true,
        helpText: "Found on the same API page as your User ID",
      },
    ],
  };

  capabilities: ConnectorCapabilities = {
    contacts: true,
    conversations: false,
    opportunities: false,
    appointments: true,
  };

  credentialGuide = CREDENTIAL_GUIDE;

  private getHeaders(creds: Record<string, string>) {
    const basic = Buffer.from(`${creds.userId}:${creds.apiKey}`).toString("base64");
    return {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
    };
  }

  async validateCredentials(
    creds: Record<string, string>
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      if (!creds.userId || !creds.apiKey) {
        return { valid: false, error: "Both User ID and API Key are required" };
      }
      const res = await fetch(`${ACUITY_API_BASE}/me`, {
        headers: this.getHeaders(creds),
      });
      if (res.ok) return { valid: true };
      if (res.status === 401) return { valid: false, error: "Invalid User ID or API Key" };
      return { valid: false, error: `Acuity API returned ${res.status}` };
    } catch {
      return { valid: false, error: "Could not connect to Acuity API" };
    }
  }

  async discoverFields(creds: Record<string, string>): Promise<FieldSchema[]> {
    // Fetch custom form fields
    const res = await fetch(`${ACUITY_API_BASE}/forms`, {
      headers: this.getHeaders(creds),
    });

    const standardFields: FieldSchema[] = [
      { key: "firstName", label: "First Name", type: "text", isStandard: true, sampleValues: [] },
      { key: "lastName", label: "Last Name", type: "text", isStandard: true, sampleValues: [] },
      { key: "email", label: "Email", type: "email", isStandard: true, sampleValues: [] },
      { key: "phone", label: "Phone", type: "phone", isStandard: true, sampleValues: [] },
      { key: "notes", label: "Notes", type: "text", isStandard: false, sampleValues: [] },
    ];

    if (!res.ok) return standardFields;

    const forms = await res.json();
    const customFields: FieldSchema[] = [];

    for (const form of forms) {
      for (const field of form.fields || []) {
        customFields.push({
          key: `field_${field.id}`,
          label: field.name,
          type: field.type === "phone" ? "phone" : field.type === "email" ? "email" : "text",
          isStandard: false,
          sampleValues: [],
        });
      }
    }

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
    let page = 1;

    while (true) {
      const res = await fetch(
        `${ACUITY_API_BASE}/clients?max=100&page=${page}`,
        { headers: this.getHeaders(creds) }
      );

      if (!res.ok) throw new Error(`Acuity clients API error: ${res.status}`);
      const clients = await res.json();

      if (!Array.isArray(clients) || clients.length === 0) break;

      yield clients.map((c: {
        id: number;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        notes?: string;
        [key: string]: unknown;
      }) => ({
        sourceId: String(c.id),
        firstName: c.firstName || undefined,
        lastName: c.lastName || undefined,
        email: c.email || undefined,
        phone: c.phone || undefined,
        customFields: c.notes ? { notes: c.notes } : {},
        source: "acuity",
        rawData: c,
      } as UniversalContact));

      if (clients.length < 100) break;
      page++;
    }
  }

  async *fetchAppointments(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalAppointment[], void, unknown> {
    let page = 1;

    while (true) {
      const res = await fetch(
        `${ACUITY_API_BASE}/appointments?max=100&page=${page}`,
        { headers: this.getHeaders(creds) }
      );

      if (!res.ok) throw new Error(`Acuity appointments API error: ${res.status}`);
      const appointments = await res.json();

      if (!Array.isArray(appointments) || appointments.length === 0) break;

      yield appointments.map((a: {
        id: number;
        type: string;
        datetime: string;
        endTime: string;
        canceled: boolean;
        clientId: number;
        notes?: string;
      }) => ({
        sourceId: String(a.id),
        contactSourceId: String(a.clientId),
        title: a.type || "Appointment",
        startTime: new Date(a.datetime),
        endTime: new Date(a.endTime),
        status: a.canceled ? "cancelled" as const : "confirmed" as const,
        notes: a.notes || undefined,
      }));

      if (appointments.length < 100) break;
      page++;
    }
  }
}
