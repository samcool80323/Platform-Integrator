import type { PlatformConnector, AuthConfig, ConnectorCapabilities } from "../types";
import type {
  FieldSchema,
  FieldMapping,
  UniversalContact,
  UniversalAppointment,
} from "../../universal-model/types";

const NOOKAL_API_BASE = "https://api.nookal.com/production/v2";

const CREDENTIAL_GUIDE = `
## How to get your Nookal API Key

---

### Step 1 — Log in to Nookal
1. Open your browser and go to **https://app.nookal.com**
2. Enter your email and password to sign in
3. ⚠️ You need to be a **Practice Owner** or **Admin** to access API settings

---

### Step 2 — Go to Settings
1. Look for the **"Settings"** option — it's usually in the top navigation bar or a gear icon ⚙️
2. Click on **"Settings"**

---

### Step 3 — Find the API section
1. Inside Settings, look for **"Integrations"** or **"API"** in the left menu
2. Click on it
3. You should see an **"API Key"** section

---

### Step 4 — Generate or copy your API Key
1. If no key exists, click **"Generate API Key"**
2. Your API key will be shown — it looks like a long random string
3. Click **"Copy"** or select and copy the whole key

---

### Step 5 — Enter it below
Paste your API key into the **"API Key"** field below.

> **Can't find the API section?** Contact Nookal support at **support@nookal.com** and ask them to enable API access for your account. It may need to be activated.

> **Note:** Nookal's API is primarily available on their Professional and Enterprise plans.
`;

export class NookalConnector implements PlatformConnector {
  id = "nookal";
  name = "Nookal";
  logo = "/logos/nookal.svg";
  description = "Import patients and appointments from Nookal practice management";

  authConfig: AuthConfig = {
    type: "api_key",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Nookal API key",
        secret: true,
        helpText: "Found in Settings → Integrations → API",
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

  private buildUrl(path: string, creds: Record<string, string>, params: Record<string, string> = {}) {
    const url = new URL(`${NOOKAL_API_BASE}${path}`);
    url.searchParams.set("api_key", creds.apiKey);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    return url.toString();
  }

  async validateCredentials(
    creds: Record<string, string>
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const res = await fetch(this.buildUrl("/verify", creds));
      if (res.ok) {
        const data = await res.json();
        if (data.results?.code === "SUCCESS") return { valid: true };
      }
      if (res.status === 401 || res.status === 403) {
        return { valid: false, error: "Invalid API key" };
      }
      return { valid: false, error: `Nookal API returned ${res.status}` };
    } catch {
      return { valid: false, error: "Could not connect to Nookal API" };
    }
  }

  async discoverFields(creds: Record<string, string>): Promise<FieldSchema[]> {
    return [
      { key: "first_name", label: "First Name", type: "text", isStandard: true, sampleValues: [] },
      { key: "last_name", label: "Last Name", type: "text", isStandard: true, sampleValues: [] },
      { key: "email", label: "Email", type: "email", isStandard: true, sampleValues: [] },
      { key: "mobile", label: "Mobile Phone", type: "phone", isStandard: true, sampleValues: [] },
      { key: "home_phone", label: "Home Phone", type: "phone", isStandard: true, sampleValues: [] },
      { key: "date_of_birth", label: "Date of Birth", type: "date", isStandard: false, sampleValues: [] },
      { key: "address", label: "Address", type: "text", isStandard: false, sampleValues: [] },
      { key: "suburb", label: "Suburb / City", type: "text", isStandard: false, sampleValues: [] },
      { key: "state", label: "State", type: "text", isStandard: false, sampleValues: [] },
      { key: "postcode", label: "Postcode", type: "text", isStandard: false, sampleValues: [] },
      { key: "country", label: "Country", type: "text", isStandard: false, sampleValues: [] },
      { key: "gender", label: "Gender", type: "text", isStandard: false, sampleValues: [] },
      { key: "occupation", label: "Occupation", type: "text", isStandard: false, sampleValues: [] },
    ];

    void creds;
  }

  getDefaultFieldMapping(): FieldMapping[] {
    return [
      { sourceField: "first_name", targetField: "firstName", targetType: "standard" },
      { sourceField: "last_name", targetField: "lastName", targetType: "standard" },
      { sourceField: "email", targetField: "email", targetType: "standard" },
      { sourceField: "mobile", targetField: "phone", targetType: "standard" },
      { sourceField: "address", targetField: "address1", targetType: "standard" },
      { sourceField: "suburb", targetField: "city", targetType: "standard" },
      { sourceField: "state", targetField: "state", targetType: "standard" },
      { sourceField: "postcode", targetField: "postalCode", targetType: "standard" },
    ];
  }

  async *fetchContacts(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalContact[], void, unknown> {
    let page = 1;

    while (true) {
      const res = await fetch(this.buildUrl("/getPatients", creds, { page: String(page) }));

      if (!res.ok) throw new Error(`Nookal patients API error: ${res.status}`);
      const data = await res.json();
      const patients = data.results?.data?.patients || [];

      if (patients.length === 0) break;

      yield patients.map((p: Record<string, unknown>) => {
        const skipKeys = new Set([
          "PatientID", "FirstName", "LastName", "Email", "MobilePhone",
          "HomePhone", "DateOfBirth", "Address1", "Suburb", "State",
          "Postcode", "Country", "Gender",
        ]);
        const customFields: Record<string, string | number | boolean> = {};
        for (const [key, value] of Object.entries(p)) {
          if (!skipKeys.has(key) && value != null && typeof value !== "object") {
            customFields[key] = value as string | number | boolean;
          }
        }

        return {
          sourceId: String(p.PatientID),
          firstName: p.FirstName ? String(p.FirstName) : undefined,
          lastName: p.LastName ? String(p.LastName) : undefined,
          email: p.Email ? String(p.Email) : undefined,
          phone: p.MobilePhone ? String(p.MobilePhone) : p.HomePhone ? String(p.HomePhone) : undefined,
          address: {
            street: p.Address1 ? String(p.Address1) : undefined,
            city: p.Suburb ? String(p.Suburb) : undefined,
            state: p.State ? String(p.State) : undefined,
            postalCode: p.Postcode ? String(p.Postcode) : undefined,
            country: p.Country ? String(p.Country) : undefined,
          },
          customFields,
          source: "nookal",
          rawData: p,
        } as UniversalContact;
      });

      if (data.results?.data?.next_page === null || patients.length < 25) break;
      page++;
    }
  }

  async *fetchAppointments(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalAppointment[], void, unknown> {
    let page = 1;

    while (true) {
      const res = await fetch(this.buildUrl("/getAppointments", creds, { page: String(page) }));

      if (!res.ok) throw new Error(`Nookal appointments API error: ${res.status}`);
      const data = await res.json();
      const appointments = data.results?.data?.appointments || [];

      if (appointments.length === 0) break;

      yield appointments.map((a: Record<string, unknown>) => ({
        sourceId: String(a.AppointmentID),
        contactSourceId: String(a.PatientID),
        title: String(a.AppointmentType || "Appointment"),
        startTime: new Date(String(a.StartDateTime)),
        endTime: new Date(String(a.EndDateTime)),
        status: a.Cancelled === "1" ? "cancelled" as const : "confirmed" as const,
        notes: a.Notes ? String(a.Notes) : undefined,
      }));

      if (data.results?.data?.next_page === null || appointments.length < 25) break;
      page++;
    }
  }
}
