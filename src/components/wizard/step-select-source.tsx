"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
  { key: "contacts" as const, label: "Contacts", icon: Users, color: "text-zinc-600" },
  { key: "conversations" as const, label: "Conversations", icon: MessageSquare, color: "text-zinc-500" },
  { key: "opportunities" as const, label: "Opportunities", icon: Target, color: "text-amber-500" },
  { key: "appointments" as const, label: "Appointments", icon: Calendar, color: "text-emerald-500" },
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
      <div className="flex items-center justify-center gap-2.5 py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm">Loading platforms...</span>
      </div>
    );
  }

  if (connectors.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p className="font-semibold">No connectors available</p>
        <p className="mt-1 text-sm">Contact support if this seems wrong.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pick the platform your client currently uses. We&apos;ll pull their data and import it into GHL.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {connectors.map((connector) => {
          const caps = capabilityConfig.filter((c) => connector.capabilities[c.key]);
          return (
            <button
              key={connector.id}
              onClick={() => onSelect(connector.id, connector.name)}
              className="group flex flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all duration-200 hover:shadow-card-hover hover:border-indigo-500/25"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-500/10 to-zinc-600/5 text-base font-bold text-zinc-600 group-hover:gradient-primary group-hover:text-white transition-all duration-300">
                    {connector.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground tracking-tight">
                      {connector.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {connector.description}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/20 transition-all duration-300 group-hover:text-indigo-500 group-hover:translate-x-0.5" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {caps.map((cap) => (
                  <Badge
                    key={cap.key}
                    variant="secondary"
                    className="text-[11px] font-medium gap-1 px-2 py-0.5 rounded-lg"
                  >
                    <cap.icon className={`h-3 w-3 ${cap.color}`} />
                    {cap.label}
                  </Badge>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
