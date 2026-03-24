import type { PlatformConnector, AuthConfig, ConnectorCapabilities } from "../types";
import type {
  FieldSchema,
  FieldMapping,
  UniversalContact,
} from "../../universal-model/types";
import { inferFieldType } from "../base";

const HUBSPOT_API_BASE = "https://api.hubapi.com";

const CREDENTIAL_GUIDE = `
## How to get your HubSpot API Token (Private App)

HubSpot uses "Private App" tokens — they are easy to create and more secure than old API keys.

---

### Step 1 — Log in to HubSpot
1. Open your browser and go to **https://app.hubspot.com**
2. Sign in with your email and password
3. If you have multiple accounts (portals), select the correct one

---

### Step 2 — Go to Private Apps
1. Click the **Settings icon** ⚙️ in the top navigation bar (top right area)
2. In the left sidebar, scroll down and click **"Integrations"**
3. Click **"Private Apps"**
   - If you can't find it, search "Private Apps" in the settings search bar at the top of the sidebar

---

### Step 3 — Create a New Private App
1. Click the **"Create a private app"** button (top right of the page)
2. Fill in:
   - **App name:** GHL Migration (or any name you like)
   - **Description:** Optional
3. Click the **"Scopes"** tab at the top
4. Enable ONLY these **read-only** scopes — do NOT enable any write scopes:
   - ✅ **crm.objects.contacts.read**
   - ✅ **crm.objects.companies.read** (optional)
   - ✅ **crm.objects.deals.read** (optional)
   > We only read/export data from HubSpot — no write access is needed.
5. Click **"Create app"** button

---

### Step 4 — Copy your Access Token
1. A popup will appear — click **"Continue creating"**
2. Your **Access Token** will now be shown — it starts with \`pat-\`
   - Example: \`pat-na1-abc123-def456-...\`
3. Click **"Copy"** to copy it
4. Paste it into the **"Access Token"** field below

> **⚠️ Important:** Copy the token now — HubSpot will not show it again after you close this window. If you lose it, you'll need to create a new private app.

> **Don't have access?** You need to be a **Super Admin** in HubSpot to create private apps. Ask your HubSpot account owner.
`;

export class HubSpotConnector implements PlatformConnector {
  id = "hubspot";
  name = "HubSpot";
  logo = "/logos/hubspot.svg";
  description = "Import contacts, companies, and deals from HubSpot CRM";

  authConfig: AuthConfig = {
    type: "api_key",
    fields: [
      {
        key: "accessToken",
        label: "Private App Access Token",
        placeholder: "pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        secret: true,
        helpText: "Create a Private App in HubSpot Settings → Integrations → Private Apps",
      },
    ],
  };

  capabilities: ConnectorCapabilities = {
    contacts: true,
    conversations: false,
    opportunities: true,
    appointments: false,
  };

  credentialGuide = CREDENTIAL_GUIDE;

  async validateCredentials(
    creds: Record<string, string>
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts?limit=1`, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          Accept: "application/json",
        },
      });
      if (res.ok) return { valid: true };
      if (res.status === 401) return { valid: false, error: "Invalid access token. Make sure you copied it correctly." };
      if (res.status === 403) return { valid: false, error: "Token doesn't have contacts.read scope. Re-create the private app with the correct scopes." };
      return { valid: false, error: `HubSpot API returned ${res.status}` };
    } catch {
      return { valid: false, error: "Could not connect to HubSpot API" };
    }
  }

  async discoverFields(creds: Record<string, string>): Promise<FieldSchema[]> {
    // Get contact properties schema from HubSpot
    const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/properties/contacts`, {
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) throw new Error(`HubSpot API error: ${res.status}`);
    const data = await res.json();
    const properties = data.results || [];

    const standardKeys = new Set([
      "firstname", "lastname", "email", "phone", "mobilephone",
      "address", "city", "state", "zip", "country",
    ]);

    return properties
      .filter((p: { hidden: boolean }) => !p.hidden)
      .map((p: { name: string; label: string; type: string }) => ({
        key: p.name,
        label: p.label,
        type: mapHubSpotType(p.type),
        isStandard: standardKeys.has(p.name),
        sampleValues: [],
      }));
  }

  getDefaultFieldMapping(): FieldMapping[] {
    return [
      { sourceField: "firstname", targetField: "firstName", targetType: "standard" },
      { sourceField: "lastname", targetField: "lastName", targetType: "standard" },
      { sourceField: "email", targetField: "email", targetType: "standard" },
      { sourceField: "phone", targetField: "phone", targetType: "standard" },
      { sourceField: "mobilephone", targetField: "phone", targetType: "standard" },
      { sourceField: "address", targetField: "address1", targetType: "standard" },
      { sourceField: "city", targetField: "city", targetType: "standard" },
      { sourceField: "state", targetField: "state", targetType: "standard" },
      { sourceField: "zip", targetField: "postalCode", targetType: "standard" },
      { sourceField: "country", targetField: "country", targetType: "standard" },
    ];
  }

  async *fetchContacts(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalContact[], void, unknown> {
    let after: string | undefined;

    const properties = [
      "firstname", "lastname", "email", "phone", "mobilephone",
      "address", "city", "state", "zip", "country",
      "company", "jobtitle", "website", "notes_last_contacted",
    ].join(",");

    do {
      const url = new URL(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`);
      url.searchParams.set("limit", "100");
      url.searchParams.set("properties", properties);
      if (after) url.searchParams.set("after", after);

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) throw new Error(`HubSpot contacts API error: ${res.status}`);
      const data = await res.json();
      const contacts = data.results || [];

      if (contacts.length === 0) break;

      yield contacts.map((c: { id: string; properties: Record<string, string | null> }) => {
        const p = c.properties;
        const standardKeys = new Set([
          "firstname", "lastname", "email", "phone", "mobilephone",
          "address", "city", "state", "zip", "country",
          "hs_object_id", "createdate", "lastmodifieddate", "hubspot_owner_id",
        ]);

        const customFields: Record<string, string | number | boolean> = {};
        for (const [key, value] of Object.entries(p)) {
          if (!standardKeys.has(key) && value != null) {
            customFields[key] = value;
          }
        }

        return {
          sourceId: c.id,
          firstName: p.firstname || undefined,
          lastName: p.lastname || undefined,
          email: p.email || undefined,
          phone: p.mobilephone || p.phone || undefined,
          address: {
            street: p.address || undefined,
            city: p.city || undefined,
            state: p.state || undefined,
            postalCode: p.zip || undefined,
            country: p.country || undefined,
          },
          customFields,
          source: "hubspot",
          rawData: p,
        } as UniversalContact;
      });

      after = data.paging?.next?.after;
    } while (after);
  }
}

function mapHubSpotType(type: string): FieldSchema["type"] {
  const map: Record<string, FieldSchema["type"]> = {
    string: "text",
    number: "number",
    date: "date",
    datetime: "date",
    bool: "boolean",
    enumeration: "select",
    phone_number: "phone",
  };
  return map[type] || "text";
}

// Suppress unused warning
void inferFieldType;
