import type { PlatformConnector, AuthConfig, ConnectorCapabilities } from "../types";
import type {
  FieldSchema,
  FieldMapping,
  UniversalContact,
  UniversalAppointment,
} from "../../universal-model/types";
import { inferFieldType } from "../base";

const CREDENTIAL_GUIDE = `
## How to get your Jane App API credentials

---

### What you'll need
- Your **Jane App subdomain** (the part before \`.janeapp.com\` in your URL)
- Your **API Key**

---

### Step 1 — Find your Jane App subdomain
1. Log in to your Jane account at **https://[yourpractice].janeapp.com**
2. Look at the browser address bar — your URL will look like:
   \`https://mypractice.janeapp.com\`
3. The word before \`.janeapp.com\` is your **subdomain** — in this example: \`mypractice\`
4. Enter this into the **"Subdomain"** field below

---

### Step 2 — Enable API Access
Jane App's API is available on the **Grow** and **Enterprise** plans.

1. Log in as the **clinic owner or admin**
2. Click your **name or clinic name** in the top right
3. Go to **Settings** → **Clinic Settings** → **Integrations**
4. Look for **"API Access"** or **"Developer"**
5. If API access is not visible, contact Jane App support to enable it for your account:
   - Email: **support@janeapp.com**
   - Or chat with them inside Jane

---

### Step 3 — Generate an API Key
1. Once in the API section, click **"Generate New API Key"** or **"Create Token"**
2. Give it a name like **"GHL Migration"**
3. Copy the key that appears

---

### Step 4 — Enter your credentials below
- **Subdomain:** e.g., \`mypractice\` (just the name, not the full URL)
- **API Key:** paste the key you copied

> **Note:** Jane App API requires a paid plan. If you see an error, contact Jane support to confirm API access is enabled.
`;

export class JaneConnector implements PlatformConnector {
  id = "jane";
  name = "Jane App";
  logo = "/logos/jane.svg";
  description = "Import patients and appointments from Jane App clinic management";

  authConfig: AuthConfig = {
    type: "api_key",
    fields: [
      {
        key: "subdomain",
        label: "Jane Subdomain",
        placeholder: "mypractice (from mypractice.janeapp.com)",
        secret: false,
        helpText: "The part before .janeapp.com in your Jane URL",
      },
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Jane App API key",
        secret: true,
        helpText: "Found in Settings → Clinic Settings → Integrations → API Access",
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
    return {
      Authorization: `Bearer ${creds.apiKey}`,
      Accept: "application/json",
    };
  }

  private getBaseUrl(creds: Record<string, string>) {
    return `https://${creds.subdomain}.janeapp.com/api/v2`;
  }

  async validateCredentials(
    creds: Record<string, string>
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      if (!creds.subdomain || !creds.apiKey) {
        return { valid: false, error: "Both subdomain and API key are required" };
      }
      const res = await fetch(`${this.getBaseUrl(creds)}/patients?page=1&per_page=1`, {
        headers: this.getHeaders(creds),
      });
      if (res.ok) return { valid: true };
      if (res.status === 401) return { valid: false, error: "Invalid API key" };
      if (res.status === 404) return { valid: false, error: "Subdomain not found — check your Jane URL" };
      return { valid: false, error: `Jane API returned ${res.status}` };
    } catch {
      return { valid: false, error: "Could not connect to Jane App. Check your subdomain is correct." };
    }
  }

  async discoverFields(creds: Record<string, string>): Promise<FieldSchema[]> {
    const res = await fetch(`${this.getBaseUrl(creds)}/patients?page=1&per_page=5`, {
      headers: this.getHeaders(creds),
    });

    if (!res.ok) throw new Error(`Jane API error: ${res.status}`);
    const data = await res.json();
    const patients = data.patients || data.data || [];

    const standardKeys = new Set([
      "first_name", "last_name", "email", "phone", "date_of_birth",
      "address", "city", "province", "postal_code", "country",
    ]);

    const fieldMap = new Map<string, unknown[]>();
    for (const p of patients) {
      for (const [key, value] of Object.entries(p as Record<string, unknown>)) {
        if (key === "id") continue;
        if (!fieldMap.has(key)) fieldMap.set(key, []);
        fieldMap.get(key)!.push(value);
      }
    }

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
      { sourceField: "phone", targetField: "phone", targetType: "standard" },
      { sourceField: "address", targetField: "address1", targetType: "standard" },
      { sourceField: "city", targetField: "city", targetType: "standard" },
      { sourceField: "province", targetField: "state", targetType: "standard" },
      { sourceField: "postal_code", targetField: "postalCode", targetType: "standard" },
    ];
  }

  async *fetchContacts(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalContact[], void, unknown> {
    let page = 1;

    while (true) {
      const res = await fetch(
        `${this.getBaseUrl(creds)}/patients?page=${page}&per_page=100`,
        { headers: this.getHeaders(creds) }
      );

      if (!res.ok) throw new Error(`Jane patients API error: ${res.status}`);
      const data = await res.json();
      const patients = data.patients || data.data || [];

      if (patients.length === 0) break;

      yield patients.map((p: Record<string, unknown>) => {
        const skipKeys = new Set([
          "id", "first_name", "last_name", "email", "phone",
          "address", "city", "province", "postal_code", "country",
          "created_at", "updated_at",
        ]);
        const customFields: Record<string, string | number | boolean> = {};
        for (const [key, value] of Object.entries(p)) {
          if (!skipKeys.has(key) && value != null && typeof value !== "object") {
            customFields[key] = value as string | number | boolean;
          }
        }

        return {
          sourceId: String(p.id),
          firstName: p.first_name ? String(p.first_name) : undefined,
          lastName: p.last_name ? String(p.last_name) : undefined,
          email: p.email ? String(p.email) : undefined,
          phone: p.phone ? String(p.phone) : undefined,
          address: {
            street: p.address ? String(p.address) : undefined,
            city: p.city ? String(p.city) : undefined,
            state: p.province ? String(p.province) : undefined,
            postalCode: p.postal_code ? String(p.postal_code) : undefined,
            country: p.country ? String(p.country) : undefined,
          },
          customFields,
          source: "jane",
          rawData: p,
        } as UniversalContact;
      });

      if (patients.length < 100) break;
      page++;
    }
  }

  async *fetchAppointments(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalAppointment[], void, unknown> {
    let page = 1;

    while (true) {
      const res = await fetch(
        `${this.getBaseUrl(creds)}/appointments?page=${page}&per_page=100`,
        { headers: this.getHeaders(creds) }
      );

      if (!res.ok) throw new Error(`Jane appointments API error: ${res.status}`);
      const data = await res.json();
      const appointments = data.appointments || data.data || [];

      if (appointments.length === 0) break;

      yield appointments.map((a: Record<string, unknown>) => ({
        sourceId: String(a.id),
        contactSourceId: a.patient_id ? String(a.patient_id) : "",
        title: String(a.treatment_name || a.service_name || "Appointment"),
        startTime: new Date(String(a.start_at || a.starts_at)),
        endTime: new Date(String(a.end_at || a.ends_at)),
        status: a.cancelled_at ? "cancelled" as const : "confirmed" as const,
        notes: a.notes ? String(a.notes) : undefined,
      }));

      if (appointments.length < 100) break;
      page++;
    }
  }
}
