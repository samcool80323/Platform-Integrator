"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare,
  Users,
  Target,
  Calendar,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface ConnectorInfo {
  id: string;
  name: string;
  logo: string;
  description: string;
  capabilities: {
    contacts: boolean;
    conversations: boolean;
    opportunities: boolean;
    appointments: boolean;
  };
}

interface StepSelectSourceProps {
  onSelect: (connectorId: string, connectorName: string) => void;
}

const capabilityConfig = [
  { key: "contacts" as const, label: "Contacts", icon: Users },
  { key: "conversations" as const, label: "Conversations", icon: MessageSquare },
  { key: "opportunities" as const, label: "Opportunities", icon: Target },
  { key: "appointments" as const, label: "Appointments", icon: Calendar },
];

export function StepSelectSource({ onSelect }: StepSelectSourceProps) {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/connectors")
      .then((r) => r.json())
      .then((data) => {
        setConnectors(data.connectors || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-accent-foreground" />
        <span className="text-[13px]">Loading platforms...</span>
      </div>
    );
  }

  if (connectors.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p className="font-semibold text-foreground">No connectors available</p>
        <p className="mt-1 text-[13px]">Contact support if this seems wrong.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        Pick the platform your client currently uses. We&apos;ll pull their data and import it into GHL.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 stagger-children">
        {connectors.map((connector) => {
          const caps = capabilityConfig.filter((c) => connector.capabilities[c.key]);
          return (
            <button
              key={connector.id}
              onClick={() => onSelect(connector.id, connector.name)}
              className="group flex flex-col rounded-lg border border-border bg-card p-4 text-left shadow-xs transition-all duration-150 hover:shadow-card hover:border-accent-foreground/20"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-[14px] font-bold text-secondary-foreground transition-colors duration-150 group-hover:bg-accent group-hover:text-accent-foreground">
                    {connector.name[0]}
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-foreground">
                      {connector.name}
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">
                      {connector.description}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/0 transition-all duration-150 group-hover:text-accent-foreground group-hover:translate-x-0.5 shrink-0 mt-0.5" />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1">
                {caps.map((cap) => (
                  <span
                    key={cap.key}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                  >
                    <cap.icon className="h-2.5 w-2.5" />
                    {cap.label}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
