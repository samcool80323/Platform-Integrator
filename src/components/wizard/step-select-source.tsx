"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  { key: "contacts" as const, label: "Contacts", icon: Users, color: "text-blue-600 dark:text-blue-400" },
  { key: "conversations" as const, label: "Conversations", icon: MessageSquare, color: "text-violet-600 dark:text-violet-400" },
  { key: "opportunities" as const, label: "Opportunities", icon: Target, color: "text-amber-600 dark:text-amber-400" },
  { key: "appointments" as const, label: "Appointments", icon: Calendar, color: "text-emerald-600 dark:text-emerald-400" },
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
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading available platforms...
      </div>
    );
  }

  if (connectors.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <p className="font-medium">No connectors available</p>
        <p className="mt-1 text-sm">Please contact support if this seems wrong.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Click on the platform your client is currently using. We&apos;ll pull their data and import it into GoHighLevel.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {connectors.map((connector) => {
          const activeCapabilities = capabilityConfig.filter(
            (c) => connector.capabilities[c.key]
          );
          return (
            <Card
              key={connector.id}
              className="group cursor-pointer border-border transition-all duration-150 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
              onClick={() => onSelect(connector.id, connector.name)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-base font-bold text-muted-foreground">
                      {connector.name[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {connector.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {connector.description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {activeCapabilities.map((cap) => (
                    <Badge
                      key={cap.key}
                      variant="secondary"
                      className="text-[11px] font-normal gap-1 px-2 py-0.5"
                    >
                      <cap.icon className={`h-3 w-3 ${cap.color}`} />
                      {cap.label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
