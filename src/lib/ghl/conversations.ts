import { GHLClient } from "./client";

/**
 * Post an internal comment on a contact's conversation in GHL.
 * Endpoint: POST /conversations/messages
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
  return client.post("/conversations/messages", {
    type: "InternalComment",
    contactId: data.contactId,
    locationId: data.locationId,
    message: data.message,
    status: "delivered",
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
