export interface UniversalContact {
  sourceId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  tags?: string[];
  companyName?: string;
  website?: string;
  customFields: Record<string, string | number | boolean>;
  source: string; // connector ID
  rawData: Record<string, unknown>;
}

export interface UniversalConversation {
  sourceId: string;
  contactSourceId: string;
  channel: "sms" | "email" | "chat" | "phone" | "other";
  messages: UniversalMessage[];
}

export interface UniversalMessage {
  sourceId: string;
  direction: "inbound" | "outbound";
  body: string;
  timestamp: Date;
  attachments?: { url: string; mimeType: string }[];
}

export interface UniversalOpportunity {
  sourceId: string;
  contactSourceId: string;
  name: string;
  value?: number;
  status: string;
  pipelineName?: string;
  stageName?: string;
  customFields: Record<string, string | number | boolean>;
}

export interface UniversalAppointment {
  sourceId: string;
  contactSourceId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  status: "confirmed" | "cancelled" | "pending" | "completed";
  notes?: string;
}

export interface FieldSchema {
  key: string;
  label: string;
  type:
    | "text"
    | "number"
    | "date"
    | "boolean"
    | "select"
    | "multiselect"
    | "url"
    | "email"
    | "phone";
  isStandard: boolean; // maps to a GHL standard field
  sampleValues?: string[];
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  targetType: "standard" | "custom";
  transform?: "none" | "date_format" | "phone_format" | "lowercase" | "uppercase";
}
