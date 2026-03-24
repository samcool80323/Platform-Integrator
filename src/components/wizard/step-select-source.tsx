"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Users, Target, Calendar } from "lucide-react";

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
    return <div className="py-12 text-center text-neutral-500">Loading connectors...</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-neutral-600">
        Select the platform your client is migrating from:
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {connectors.map((connector) => (
          <Card
            key={connector.id}
            className="cursor-pointer transition-all hover:border-neutral-400 hover:shadow-md"
            onClick={() => onSelect(connector.id, connector.name)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-lg font-bold text-neutral-700">
                  {connector.name[0]}
                </div>
                <CardTitle className="text-lg">{connector.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-neutral-500">
                {connector.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {connector.capabilities.contacts && (
                  <Badge variant="secondary" className="text-xs">
                    <Users className="mr-1 h-3 w-3" /> Contacts
                  </Badge>
                )}
                {connector.capabilities.conversations && (
                  <Badge variant="secondary" className="text-xs">
                    <MessageSquare className="mr-1 h-3 w-3" /> Conversations
                  </Badge>
                )}
                {connector.capabilities.opportunities && (
                  <Badge variant="secondary" className="text-xs">
                    <Target className="mr-1 h-3 w-3" /> Opportunities
                  </Badge>
                )}
                {connector.capabilities.appointments && (
                  <Badge variant="secondary" className="text-xs">
                    <Calendar className="mr-1 h-3 w-3" /> Appointments
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
