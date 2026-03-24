import type { PlatformConnector } from "./types";
import { PodiumConnector } from "./podium";
import { DentallyConnector } from "./dentally";
import { MondayConnector } from "./monday";
import { ClinicoConnector } from "./clinico";
import { HubSpotConnector } from "./hubspot";
import { ActiveCampaignConnector } from "./activecampaign";
import { PipedriveConnector } from "./pipedrive";
import { JaneConnector } from "./jane";
import { AcuityConnector } from "./acuity";
import { NookalConnector } from "./nookal";

const connectors = new Map<string, PlatformConnector>();

function register(connector: PlatformConnector) {
  connectors.set(connector.id, connector);
}

// ── Clinic / Healthcare ──────────────────────────────────────────────────────
register(new DentallyConnector());    // Dental practice management (UK)
register(new ClinicoConnector());     // Allied health / physio (AU/NZ/CA)
register(new JaneConnector());        // Health clinic management (AU/CA/UK)
register(new NookalConnector());      // Allied health practice management (AU)
register(new AcuityConnector());      // Appointment scheduling (all industries)

// ── General CRM ─────────────────────────────────────────────────────────────
register(new HubSpotConnector());     // Popular free/paid CRM
register(new PipedriveConnector());   // Sales-focused CRM
register(new ActiveCampaignConnector()); // Email marketing + CRM
register(new MondayConnector());      // Project / CRM boards

// ── Review & Messaging ───────────────────────────────────────────────────────
register(new PodiumConnector());      // Review & messaging platform (OAuth2)

export function getConnector(id: string): PlatformConnector | undefined {
  return connectors.get(id);
}

export function listConnectors(): PlatformConnector[] {
  return Array.from(connectors.values());
}

export function getConnectorIds(): string[] {
  return Array.from(connectors.keys());
}
