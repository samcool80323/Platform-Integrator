import { GHLClient } from "./client";

/**
 * Create (or find) a GHL conversation for a contact so we can post messages.
 * Endpoint: POST /conversations/
 * Returns the conversation id.
 */
async function getOrCreateConversation(
  client: GHLClient,
  contactId: string,
  locationId: string
): Promise<string> {
  // Search for an existing conversation first
  const search = await client.get<{
    conversations?: { id: string }[];
  }>("/conversations/search", { contactId, locationId });

  const existing = search?.conversations?.[0];
  if (existing?.id) return existing.id;

  // No existing conversation — create one
  const created = await client.post<{
    conversation?: { id: string };
    id?: string;
  }>("/conversations/", { contactId, locationId });

  const convId = created?.conversation?.id || created?.id;
  if (!convId) throw new Error(`Failed to create GHL conversation for contact ${contactId}`);
  return convId;
}

/**
 * Post an internal comment on a contact's conversation in GHL.
 * First creates/finds the conversation, then posts the message.
 * Type: "InternalComment" — visible only to team, not the contact.
 */
export async function postInternalComment(
  client: GHLClient,
  data: {
    contactId: string;
    locationId: string;
    message: string;
  }
): Promise<unknown> {
  const conversationId = await getOrCreateConversation(
    client,
    data.contactId,
    data.locationId
  );

  return client.post("/conversations/messages", {
    type: "InternalComment",
    conversationId,
    message: data.message,
  });
}

/**
 * Add an internal note on a contact.
 * Endpoint: POST /contacts/{contactId}/notes
 */
export async function addContactNote(
  client: GHLClient,
  data: {
    contactId: string;
    body: string;
  }
): Promise<unknown> {
  return client.post(`/contacts/${data.contactId}/notes`, {
    body: data.body,
  });
}
