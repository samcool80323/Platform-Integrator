import { GHLClient } from "./client";

export interface GHLMessage {
  type: string;
  contactId: string;
  message: string;
  conversationId?: string;
  conversationProviderId?: string;
  direction?: "inbound" | "outbound";
  date?: string;
}

export async function addInboundMessage(
  client: GHLClient,
  data: {
    contactId: string;
    message: string;
    type?: string;
    date?: string;
  }
): Promise<unknown> {
  return client.post("/conversations/messages/inbound", {
    type: data.type || "SMS",
    contactId: data.contactId,
    message: data.message,
    date: data.date,
  });
}

export async function addOutboundMessage(
  client: GHLClient,
  data: {
    contactId: string;
    message: string;
    type?: string;
    date?: string;
  }
): Promise<unknown> {
  return client.post("/conversations/messages", {
    type: data.type || "SMS",
    contactId: data.contactId,
    message: data.message,
    date: data.date,
  });
}

/**
 * Add an internal note on a contact.
 * GHL endpoint: POST /contacts/{contactId}/notes
 * This is for imported conversation history — always as notes, never as messages.
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
