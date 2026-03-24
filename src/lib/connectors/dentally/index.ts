import type { PlatformConnector, AuthConfig, ConnectorCapabilities } from "../types";
import type {
  FieldSchema,
  FieldMapping,
  UniversalContact,
  UniversalAppointment,
} from "../../universal-model/types";
import { inferFieldType } from "../base";

const DENTALLY_API_BASE = "https://api.dentally.co/v1";

const CREDENTIAL_GUIDE = `
## How to get your Dentally API key

---

### Step 1 — Log in to Dentally
1. Open your browser and go to **https://app.dentally.co**
2. Enter your email and password
3. ⚠️ You must be logged in as a **Practice Admin** — regular staff accounts cannot generate API keys. If you are not the admin, ask your practice manager to do these steps.

---

### Step 2 — Open Settings
1. Look at the **top right corner** of your screen — you'll see your practice name or a profile icon
2. Click on it
3. A dropdown will appear — click **"Settings"**

---

### Step 3 — Go to API Access
1. Inside Settings, look at the **left sidebar menu**
2. Click **"Integrations"**
3. Then click **"API Access"**
   - If you don't see this option, you may not have admin permissions

---

### Step 4 — Generate a New API Key
1. Click the **"Generate API Key"** button (it may also say **"New API Key"**)
2. Give it a name so you remember what it's for — e.g., **"GHL Migration"**
3. Click **"Generate"** or **"Confirm"**

---

### Step 5 — Copy and paste your API key
1. Your API key will appear — it looks like a long string of random characters, e.g.: \`eyJhbGci...\`
2. **Copy it immediately!** Dentally may only show it once.
3. Paste it into the **"API Key"** field below

> **Tip:** If you lose the key, you can always generate a new one from the same screen.
`;

export class DentallyConnector implements PlatformConnector {
  id = "dentally";
  name = "Dentally";
  logo = "/logos/dentally.svg";
  description = "Import patients, appointments, and treatment data from Dentally";

  authConfig: AuthConfig = {
    type: "api_key",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Dentally API key",
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

  async validateCredentials(
    creds: Record<string, string>
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const res = await fetch(`${DENTALLY_API_BASE}/practices`, {
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          Accept: "application/json",
        },
      });
      if (res.ok) return { valid: true };
      if (res.status === 401) return { valid: false, error: "Invalid API key" };
      return { valid: false, error: `Dentally API returned ${res.status}` };
    } catch {
      return { valid: false, error: "Could not connect to Dentally API" };
    }
  }

  async discoverFields(creds: Record<string, string>): Promise<FieldSchema[]> {
    const res = await fetch(`${DENTALLY_API_BASE}/patients?per_page=5`, {
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) throw new Error(`Dentally API error: ${res.status}`);
    const data = await res.json();
    const patients = data.patients || data.data || [];

    const fieldMap = new Map<string, unknown[]>();
    for (const patient of patients) {
      for (const [key, value] of Object.entries(patient as Record<string, unknown>)) {
        if (key === "id") continue;
        if (!fieldMap.has(key)) fieldMap.set(key, []);
        fieldMap.get(key)!.push(value);
      }
    }

    const standardKeys = new Set([
      "first_name", "last_name", "email", "phone", "mobile",
      "address_line_1", "city", "postcode", "date_of_birth",
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
      { sourceField: "mobile", targetField: "phone", targetType: "standard" },
      { sourceField: "address_line_1", targetField: "address1", targetType: "standard" },
      { sourceField: "city", targetField: "city", targetType: "standard" },
      { sourceField: "postcode", targetField: "postalCode", targetType: "standard" },
    ];
  }

  async *fetchContacts(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalContact[], void, unknown> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const res = await fetch(
        `${DENTALLY_API_BASE}/patients?per_page=100&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${creds.apiKey}`,
            Accept: "application/json",
          },
        }
      );

      if (!res.ok) throw new Error(`Dentally patients API error: ${res.status}`);
      const data = await res.json();
      const patients = data.patients || data.data || [];

      if (patients.length === 0) break;

      yield patients.map((p: Record<string, unknown>) => {
        const customFields: Record<string, string | number | boolean> = {};
        const skipKeys = new Set([
          "id", "first_name", "last_name", "email", "phone", "mobile",
          "address_line_1", "city", "postcode", "created_at", "updated_at",
        ]);

        for (const [key, value] of Object.entries(p)) {
          if (!skipKeys.has(key) && value != null) {
            customFields[key] = typeof value === "object"
              ? JSON.stringify(value)
              : (value as string | number | boolean);
          }
        }

        return {
          sourceId: String(p.id),
          firstName: p.first_name ? String(p.first_name) : undefined,
          lastName: p.last_name ? String(p.last_name) : undefined,
          email: p.email ? String(p.email) : undefined,
          phone: p.mobile ? String(p.mobile) : p.phone ? String(p.phone) : undefined,
          address: {
            street: p.address_line_1 ? String(p.address_line_1) : undefined,
            city: p.city ? String(p.city) : undefined,
            postalCode: p.postcode ? String(p.postcode) : undefined,
          },
          customFields,
          source: "dentally",
          rawData: p,
        } as UniversalContact;
      });

      hasMore = patients.length === 100;
      page++;
    }
  }

  async *fetchAppointments(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalAppointment[], void, unknown> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const res = await fetch(
        `${DENTALLY_API_BASE}/appointments?per_page=100&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${creds.apiKey}`,
            Accept: "application/json",
          },
        }
      );

      if (!res.ok) throw new Error(`Dentally appointments API error: ${res.status}`);
      const data = await res.json();
      const appointments = data.appointments || data.data || [];

      if (appointments.length === 0) break;

      yield appointments.map((a: Record<string, unknown>) => ({
        sourceId: String(a.id),
        contactSourceId: String(a.patient_id),
        title: String(a.treatment_description || a.reason || "Appointment"),
        startTime: new Date(String(a.start_time || a.starts_at)),
        endTime: new Date(String(a.end_time || a.ends_at)),
        status: mapDentallyStatus(String(a.state || a.status || "pending")),
        notes: a.notes ? String(a.notes) : undefined,
      }));

      hasMore = appointments.length === 100;
      page++;
    }
  }
}

function mapDentallyStatus(
  status: string
): "confirmed" | "cancelled" | "pending" | "completed" {
  const lower = status.toLowerCase();
  if (lower.includes("confirm")) return "confirmed";
  if (lower.includes("cancel")) return "cancelled";
  if (lower.includes("complete") || lower.includes("attended")) return "completed";
  return "pending";
}
