import type { PlatformConnector, AuthConfig, ConnectorCapabilities } from "../types";
import type {
  FieldSchema,
  FieldMapping,
  UniversalContact,
  UniversalAppointment,
} from "../../universal-model/types";
import { inferFieldType } from "../base";

const CLINICO_API_BASE = "https://api.cliniko.com/v1";

const CREDENTIAL_GUIDE = `
## How to get your Cliniko API Key

---

### Step 1 — Log in to Cliniko
1. Open your browser and go to your Cliniko account URL
   - It usually looks like: **https://[yourpractice].cliniko.com**
   - Or go to **https://www.cliniko.com** and click "Sign In"
2. Enter your email and password

---

### Step 2 — Go to My Info
1. Look at the **top right corner** of the screen — you'll see your name
2. Click on your name
3. A dropdown appears — click **"My Info"**

---

### Step 3 — Scroll down to API Keys
1. The "My Info" page will open
2. Scroll down towards the bottom of the page
3. Look for a section called **"API Keys"**

---

### Step 4 — Generate a New API Key
1. Click the **"Generate New API Key"** button
2. A popup or new section will appear — you can give it a label like **"GHL Migration"** (optional)
3. Click **"Generate"** or **"Confirm"**

---

### Step 5 — Copy your API Key
1. Your API key will appear — it looks like a long random string, often ending in \`==\`
   - Example: \`MjoxMjM0NTY3OC1hYmNk...\`
2. Copy the entire key
3. Paste it into the **"API Key"** field below

> **Important:** Each staff member has their own API key. Use an admin account's key to ensure full access to patient data.

> **Tip:** If the API Keys section doesn't appear, ask your Cliniko account owner — API access may need to be enabled for your account.
`;

export class ClinicoConnector implements PlatformConnector {
  id = "clinico";
  name = "Cliniko";
  logo = "/logos/clinico.svg";
  description = "Import patients and appointments from Cliniko";

  authConfig: AuthConfig = {
    type: "header_auth",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Cliniko API key",
        secret: true,
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

  private getHeaders(apiKey: string) {
    // Cliniko uses HTTP Basic: apiKey as username, blank password
    const basic = Buffer.from(`${apiKey}:`).toString("base64");
    return {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
      "User-Agent": "PlatformIntegrator (support@example.com)",
    };
  }

  async validateCredentials(
    creds: Record<string, string>
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const res = await fetch(`${CLINICO_API_BASE}/users`, {
        headers: this.getHeaders(creds.apiKey),
      });
      if (res.ok) return { valid: true };
      if (res.status === 401) return { valid: false, error: "Invalid API key" };
      return { valid: false, error: `Cliniko API returned ${res.status}` };
    } catch {
      return { valid: false, error: "Could not connect to Cliniko API" };
    }
  }

  async discoverFields(creds: Record<string, string>): Promise<FieldSchema[]> {
    const res = await fetch(`${CLINICO_API_BASE}/patients?per_page=5`, {
      headers: this.getHeaders(creds.apiKey),
    });

    if (!res.ok) throw new Error(`Cliniko API error: ${res.status}`);
    const data = await res.json();
    const patients = data.patients || [];

    const fieldMap = new Map<string, unknown[]>();
    for (const patient of patients) {
      for (const [key, value] of Object.entries(patient as Record<string, unknown>)) {
        if (key === "id" || key === "links" || key === "created_at" || key === "updated_at") continue;
        if (typeof value === "object" && value !== null && !Array.isArray(value)) continue;
        if (!fieldMap.has(key)) fieldMap.set(key, []);
        fieldMap.get(key)!.push(value);
      }
    }

    const standardKeys = new Set([
      "first_name", "last_name", "email", "phone_numbers",
      "address_1", "city", "state", "post_code", "country",
      "date_of_birth",
    ]);

    return Array.from(fieldMap.entries()).map(([key, values]) => ({
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      type: inferFieldType(values),
      isStandard: standardKeys.has(key),
      sampleValues: values.filter((v) => v != null).slice(0, 3).map(String),
    }));
  }

  getDefaultFieldMapping(): FieldMapping[] {
    return [
      { sourceField: "first_name", targetField: "firstName", targetType: "standard" },
      { sourceField: "last_name", targetField: "lastName", targetType: "standard" },
      { sourceField: "email", targetField: "email", targetType: "standard" },
      { sourceField: "address_1", targetField: "address1", targetType: "standard" },
      { sourceField: "city", targetField: "city", targetType: "standard" },
      { sourceField: "state", targetField: "state", targetType: "standard" },
      { sourceField: "post_code", targetField: "postalCode", targetType: "standard" },
      { sourceField: "country", targetField: "country", targetType: "standard" },
    ];
  }

  async *fetchContacts(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalContact[], void, unknown> {
    let url: string | null = `${CLINICO_API_BASE}/patients?per_page=100`;

    while (url) {
      const res: Response = await fetch(url, {
        headers: this.getHeaders(creds.apiKey),
      });

      if (!res.ok) throw new Error(`Cliniko patients API error: ${res.status}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const patients = data.patients || [];

      if (patients.length === 0) break;

      yield patients.map((p: Record<string, unknown>) => {
        const customFields: Record<string, string | number | boolean> = {};
        const skipKeys = new Set([
          "id", "first_name", "last_name", "email", "phone_numbers",
          "address_1", "city", "state", "post_code", "country",
          "links", "created_at", "updated_at",
        ]);

        for (const [key, value] of Object.entries(p)) {
          if (!skipKeys.has(key) && value != null && typeof value !== "object") {
            customFields[key] = value as string | number | boolean;
          }
        }

        // Cliniko stores phone numbers as an array
        const phones = p.phone_numbers as { number: string }[] | undefined;
        const phone = phones?.[0]?.number;

        return {
          sourceId: String(p.id),
          firstName: p.first_name ? String(p.first_name) : undefined,
          lastName: p.last_name ? String(p.last_name) : undefined,
          email: p.email ? String(p.email) : undefined,
          phone,
          address: {
            street: p.address_1 ? String(p.address_1) : undefined,
            city: p.city ? String(p.city) : undefined,
            state: p.state ? String(p.state) : undefined,
            postalCode: p.post_code ? String(p.post_code) : undefined,
            country: p.country ? String(p.country) : undefined,
          },
          customFields,
          source: "clinico",
          rawData: p,
        } as UniversalContact;
      });

      // Cliniko uses Link header for pagination
      url = data.links?.next || null;
    }
  }

  async *fetchAppointments(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalAppointment[], void, unknown> {
    let url: string | null = `${CLINICO_API_BASE}/individual_appointments?per_page=100`;

    while (url) {
      const res: Response = await fetch(url, {
        headers: this.getHeaders(creds.apiKey),
      });

      if (!res.ok) throw new Error(`Cliniko appointments API error: ${res.status}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const appointments = data.individual_appointments || [];

      if (appointments.length === 0) break;

      yield appointments.map((a: Record<string, unknown>) => ({
        sourceId: String(a.id),
        contactSourceId: String(a.patient_id),
        title: String((a.appointment_type as Record<string, unknown> | undefined)?.name || "Appointment"),
        startTime: new Date(String(a.starts_at)),
        endTime: new Date(String(a.ends_at)),
        status: a.cancelled_at ? "cancelled" as const : a.did_not_arrive ? "cancelled" as const : "confirmed" as const,
        notes: a.notes ? String(a.notes) : undefined,
      }));

      url = data.links?.next || null;
    }
  }
}
