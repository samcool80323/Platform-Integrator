"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, RefreshCw } from "lucide-react";

interface Migration {
  id: string;
  connectorId: string;
  ghlLocationName: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  totalContacts: number;
  processedContacts: number;
  failedContacts: number;
  totalConversations: number;
  processedConversations: number;
  failedConversations: number;
  createdAt: string;
}

interface LogEntry {
  id: string;
  level: string;
  message: string;
  timestamp: string;
}

export default function MigrationDetailPage() {
  const params = useParams();
  const migrationId = params.migrationId as string;
  const [migration, setMigration] = useState<Migration | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMigration();
    loadLogs();
    const eventSource = new EventSource(`/api/events?migrationId=${migrationId}`);
    eventSource.onmessage = () => {
      loadMigration();
    };
    eventSource.onerror = () => {
      eventSource.close();
    };
    return () => eventSource.close();
  }, [migrationId]);

  async function loadMigration() {
    const res = await fetch(`/api/migrations/${migrationId}`);
    if (res.ok) {
      const data = await res.json();
      setMigration(data.migration);
    }
    setLoading(false);
  }

  async function loadLogs() {
    const res = await fetch(`/api/migrations/${migrationId}/logs`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs || []);
    }
  }

  async function handleRetry() {
    await fetch(`/api/migrations/${migrationId}/start`, { method: "POST" });
    loadMigration();
  }

  if (loading || !migration) {
    return (
      <div className="py-12 text-center text-muted-foreground">Loading...</div>
    );
  }

  const contactProgress =
    migration.totalContacts > 0
      ? Math.round(
          (migration.processedContacts / migration.totalContacts) * 100
        )
      : 0;

  const convProgress =
    migration.totalConversations > 0
      ? Math.round(
          (migration.processedConversations / migration.totalConversations) * 100
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Migration Details
          </h1>
          <p className="text-sm text-muted-foreground">
            {migration.connectorId} → {migration.ghlLocationName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={migration.status} />
          {(migration.status === "FAILED" ||
            migration.status === "COMPLETED_WITH_ERRORS") && (
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-foreground">
                <span>
                  {migration.processedContacts} / {migration.totalContacts}
                </span>
                <span>{contactProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${contactProgress}%` }}
                />
              </div>
              {migration.failedContacts > 0 && (
                <p className="text-sm text-destructive">
                  {migration.failedContacts} failed
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-foreground">
                <span>
                  {migration.processedConversations} /{" "}
                  {migration.totalConversations}
                </span>
                <span>{convProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${convProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs — intentionally dark terminal style in both modes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Logs
            </div>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadLogs}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 space-y-1 overflow-y-auto rounded-md bg-slate-950 p-4 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-slate-500">No logs yet...</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={
                    log.level === "ERROR"
                      ? "text-red-400"
                      : log.level === "WARN"
                        ? "text-yellow-400"
                        : "text-slate-300"
                  }
                >
                  <span className="text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString()}{" "}
                  </span>
                  <span className="mr-2">[{log.level}]</span>
                  {log.message}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    PENDING: { label: "Pending", variant: "outline" },
    RUNNING: { label: "Running", variant: "default" },
    COMPLETED: { label: "Completed", variant: "secondary" },
    COMPLETED_WITH_ERRORS: { label: "Partial", variant: "outline" },
    FAILED: { label: "Failed", variant: "destructive" },
    CANCELLED: { label: "Cancelled", variant: "outline" },
  };
  const c = config[status] || { label: status, variant: "outline" as const };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}
