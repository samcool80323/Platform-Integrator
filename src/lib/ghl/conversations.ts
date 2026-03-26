import { GHLClient } from "./client";

/**
 * Add an internal note on a contact.
 * GHL endpoint: POST /contacts/{contactId}/notes
 *
 * ALL imported conversations go here as a single transcript — never as
 * inbound/outbound messages. This keeps the GHL conversation tab clean
 * and avoids triggering automations or notifications.
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
