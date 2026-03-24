import { GHLClient } from "./client";

export interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  website?: string;
  companyName?: string;
  tags?: string[];
  source?: string;
  customFields?: { id: string; value: unknown }[];
  [key: string]: unknown;
}

interface SearchResult {
  contacts: GHLContact[];
  total: number;
}

export async function searchContacts(
  client: GHLClient,
  locationId: string,
  query: { email?: string; phone?: string }
): Promise<GHLContact[]> {
  const filters: unknown[] = [];
  if (query.email) {
    filters.push({ field: "email", operator: "eq", value: query.email });
  }
  if (query.phone) {
    filters.push({ field: "phone", operator: "eq", value: query.phone });
  }

  if (filters.length === 0) return [];

  const result = await client.post<SearchResult>("/contacts/search", {
    locationId,
    filters,
    page: 1,
    pageLimit: 10,
  });

  return result.contacts || [];
}

export async function createContact(
  client: GHLClient,
  locationId: string,
  data: Partial<GHLContact>
): Promise<GHLContact> {
  const result = await client.post<{ contact: GHLContact }>("/contacts", {
    ...data,
    locationId,
  });
  return result.contact;
}

export async function updateContact(
  client: GHLClient,
  contactId: string,
  data: Partial<GHLContact>
): Promise<GHLContact> {
  const result = await client.put<{ contact: GHLContact }>(
    `/contacts/${contactId}`,
    data
  );
  return result.contact;
}

/**
 * Upsert a contact: search by email/phone, update if found, create if not.
 */
export async function upsertContact(
  client: GHLClient,
  locationId: string,
  data: Partial<GHLContact>
): Promise<{ contact: GHLContact; action: "created" | "updated" }> {
  // Try to find existing contact by email or phone
  const existing = await searchContacts(client, locationId, {
    email: data.email,
    phone: data.phone,
  });

  if (existing.length > 0) {
    const updated = await updateContact(client, existing[0].id, data);
    return { contact: updated, action: "updated" };
  }

  const created = await createContact(client, locationId, data);
  return { contact: created, action: "created" };
}
