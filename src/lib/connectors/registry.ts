import type { PlatformConnector } from "./types";
import { PodiumConnector } from "./podium";
import { DentallyConnector } from "./dentally";
import { MondayConnector } from "./monday";
import { ClinicoConnector } from "./clinico";

const connectors = new Map<string, PlatformConnector>();

function register(connector: PlatformConnector) {
  connectors.set(connector.id, connector);
}

// Register all connectors
register(new PodiumConnector());
register(new DentallyConnector());
register(new MondayConnector());
register(new ClinicoConnector());

export function getConnector(id: string): PlatformConnector | undefined {
  return connectors.get(id);
}

export function listConnectors(): PlatformConnector[] {
  return Array.from(connectors.values());
}

export function getConnectorIds(): string[] {
  return Array.from(connectors.keys());
}
