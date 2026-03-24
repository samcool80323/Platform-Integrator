import type {
  FieldSchema,
  FieldMapping,
  UniversalContact,
  UniversalConversation,
  UniversalOpportunity,
  UniversalAppointment,
} from "../universal-model/types";

export interface AuthField {
  key: string;
  label: string;
  placeholder: string;
  secret: boolean;
  helpText?: string;
}

export interface AuthConfig {
  type: "api_key" | "oauth2" | "header_auth" | "custom";
  // For api_key / header_auth
  fields?: AuthField[];
  // For oauth2
  authorizationUrl?: string;
  tokenUrl?: string;
  scopes?: string[];
  // Human-readable descriptions for each scope
  scopeDescriptions?: Record<string, string>;
}

export interface ConnectorCapabilities {
  contacts: boolean;
  conversations: boolean;
  opportunities: boolean;
  appointments: boolean;
}

export interface PlatformConnector {
  id: string;
  name: string;
  logo: string;
  description: string;
  authConfig: AuthConfig;
  capabilities: ConnectorCapabilities;
  credentialGuide: string; // markdown instructions

  validateCredentials(
    creds: Record<string, string>
  ): Promise<{ valid: boolean; error?: string }>;

  discoverFields(creds: Record<string, string>): Promise<FieldSchema[]>;

  getDefaultFieldMapping(): FieldMapping[];

  fetchContacts(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalContact[], void, unknown>;

  fetchConversations?(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalConversation[], void, unknown>;

  fetchOpportunities?(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalOpportunity[], void, unknown>;

  fetchAppointments?(
    creds: Record<string, string>
  ): AsyncGenerator<UniversalAppointment[], void, unknown>;
}
