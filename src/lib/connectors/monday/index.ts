import type { PlatformConnector, AuthConfig, ConnectorCapabilities } from "../types";
import type {
  FieldSchema,
  FieldMapping,
  UniversalContact,
} from "../../universal-model/types";
import { inferFieldType } from "../base";

const MONDAY_API_URL = "https://api.monday.com/v2";

const CREDENTIAL_GUIDE = `
## How to get your Monday.com API Token and Board ID

You'll need two things: an **API Token** and your **Board ID**.

---

### Step 1 — Log in to Monday.com
1. Open your browser and go to **https://monday.com**
2. Sign in with your email and password

---

### Step 2 — Get your API Token
1. Look at the **bottom-left corner** of your screen — click your **profile picture** (your initials or photo)
2. A menu appears — click **"Developers"**
3. A new page opens — click **"My Access Tokens"** in the left sidebar
4. You'll see a token listed — click **"Show"** or **"Copy"** to copy it
5. It looks like: \`eyJhbGciOiJIUzI1NiJ9...\` (a long string starting with "eyJ")
6. Paste it into the **"API Token"** field below

> **Can't find Developers?** Try clicking your profile picture → **"Admin"** → **"API"** instead.

---

### Step 3 — Get your Board ID
The Board ID is the number in the URL when you open your board.

1. Go back to your Monday.com workspace
2. Click on the **board** you want to import contacts from (e.g., "Leads", "Patients", "Clients")
3. Look at your browser's address bar — the URL will look like:
   \`https://mycompany.monday.com/boards/1234567890\`
4. The number at the end (e.g., **1234567890**) is your **Board ID**
5. Copy that number and paste it into the **"Board ID"** field below

> **Which board should I pick?** Choose the board that has your contact or lead information — names, phone numbers, emails, etc.
`;

export class MondayConnector implements PlatformConnector {
  id = "monday";
  name = "Monday.com";
  logo = "/logos/monday.svg";
  description = "Import items/leads from Monday.com boards as contacts";

  authConfig: AuthConfig = {
    type: "api_key",
    fields: [
      {
        key: "apiToken",
        label: "API Token",
        placeholder: "Enter your Monday.com API token",
        secret: true,
      },
      {
        key: "boardId",
        label: "Board ID",
        placeholder: "Enter the board ID to import from",
        secret: false,
        helpText: "Find this in the board URL: monday.com/boards/BOARD_ID",
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

  private async graphql(token: string, query: string, variables?: Record<string, unknown>) {
    const res = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Monday API error: ${res.status}`);
    const data = await res.json();
    if (data.errors) throw new Error(data.errors[0].message);
    return data.data;
  }

  async validateCredentials(
    creds: Record<string, string>
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.graphql(creds.apiToken, `{ me { id name } }`);
      return { valid: true };
    } catch (e) {
      return { valid: false, error: "Invalid API token" };
    }
  }

  async discoverFields(creds: Record<string, string>): Promise<FieldSchema[]> {
    const data = await this.graphql(
      creds.apiToken,
      `query ($boardId: [ID!]) {
        boards(ids: $boardId) {
          columns { id title type settings_str }
          items_page(limit: 5) {
            items {
              column_values { id text value }
            }
          }
        }
      }`,
      { boardId: [creds.boardId] }
    );

    const board = data.boards[0];
    if (!board) throw new Error("Board not found");

    const items = board.items_page?.items || [];
    const fields: FieldSchema[] = [];

    for (const col of board.columns) {
      const sampleValues = items
        .map((item: { column_values: { id: string; text: string }[] }) =>
          item.column_values.find((cv) => cv.id === col.id)?.text
        )
        .filter(Boolean)
        .slice(0, 3);

      fields.push({
        key: col.id,
        label: col.title,
        type: mapMondayColumnType(col.type),
        isStandard: ["email", "phone", "text", "name"].includes(col.type),
        sampleValues,
      });
    }

    return fields;
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
    let cursor: string | null = null;

    do {
      const query = cursor
        ? `query ($boardId: [ID!], $cursor: String!) {
            boards(ids: $boardId) {
              items_page(limit: 100, cursor: $cursor) {
                cursor
                items { id name column_values { id text value } }
              }
            }
          }`
        : `query ($boardId: [ID!]) {
            boards(ids: $boardId) {
              items_page(limit: 100) {
                cursor
                items { id name column_values { id text value } }
              }
            }
          }`;

      const variables: Record<string, unknown> = { boardId: [creds.boardId] };
      if (cursor) variables.cursor = cursor;

      const data = await this.graphql(creds.apiToken, query, variables);
      const board = data.boards[0];
      const page = board?.items_page;
      const items = page?.items || [];

      if (items.length === 0) break;

      yield items.map((item: { id: string; name: string; column_values: { id: string; text: string }[] }) => {
        const customFields: Record<string, string | number | boolean> = {};
        let email: string | undefined;
        let phone: string | undefined;

        for (const cv of item.column_values) {
          if (cv.id === "email" || cv.text?.includes("@")) {
            email = cv.text;
          } else if (cv.id === "phone") {
            phone = cv.text;
          } else if (cv.text) {
            customFields[cv.id] = cv.text;
          }
        }

        const nameParts = item.name.split(" ");
        return {
          sourceId: item.id,
          firstName: nameParts[0] || "",
          lastName: nameParts.slice(1).join(" ") || "",
          email,
          phone,
          customFields,
          source: "monday",
          rawData: item,
        } as UniversalContact;
      });

      cursor = page?.cursor || null;
    } while (cursor);
  }
}

function mapMondayColumnType(type: string): FieldSchema["type"] {
  const map: Record<string, FieldSchema["type"]> = {
    email: "email",
    phone: "phone",
    date: "date",
    numbers: "number",
    checkbox: "boolean",
    dropdown: "select",
    link: "url",
  };
  return map[type] || "text";
}
