"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Users,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Terminal,
} from "lucide-react";

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
      <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading migration details...
      </div>
    );
  }

  const contactProgress =
    migration.totalContacts > 0
      ? Math.round((migration.processedContacts / migration.totalContacts) * 100)
      : 0;

  const convProgress =
    migration.totalConversations > 0
      ? Math.round((migration.processedConversations / migration.totalConversations) * 100)
      : 0;

  const isRunning = migration.status === "RUNNING";
  const isFailed = migration.status === "FAILED" || migration.status === "COMPLETED_WITH_ERRORS";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Link>

        <div className="flex items-start justify-between mt-2">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                Migration Details
              </h1>
              <StatusBadge status={migration.status} />
            </div>
            <p className="mt-1 text-muted-foreground">
              {migration.connectorId} → {migration.ghlLocationName}
            </p>
            {migration.startedAt && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Started {new Date(migration.startedAt).toLocaleString()}
                {migration.completedAt && (
                  <> · Completed {new Date(migration.completedAt).toLocaleString()}</>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isFailed && (
              <Button variant="outline" size="sm" onClick={handleRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry Failed Records
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Progress cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ProgressCard
          title="Contacts"
          icon={Users}
          total={migration.totalContacts}
          processed={migration.processedContacts}
          failed={migration.failedContacts}
          progress={contactProgress}
          isRunning={isRunning}
        />
        <ProgressCard
          title="Conversations"
          icon={MessageSquare}
          total={migration.totalConversations}
          processed={migration.processedConversations}
          failed={migration.failedConversations}
          progress={convProgress}
          isRunning={isRunning}
        />
      </div>

      {/* Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4" />
              Migration Log
            </CardTitle>
            <CardDescription>
              {isRunning
                ? "Live log updates while migration is running"
                : `${logs.length} log entries`}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadLogs} className="gap-1.5 text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="max-h-[400px] space-y-0.5 overflow-y-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-relaxed">
            {logs.length === 0 ? (
              <p className="text-slate-500 py-4 text-center">
                {isRunning ? "Waiting for log entries..." : "No logs recorded for this migration."}
              </p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`py-0.5 ${
                    log.level === "ERROR"
                      ? "text-red-400"
                      : log.level === "WARN"
                        ? "text-yellow-400"
                        : "text-slate-300"
                  }`}
                >
                  <span className="text-slate-600 select-none">
                    {new Date(log.timestamp).toLocaleTimeString()}{" "}
                  </span>
                  <span className={`mr-2 ${
                    log.level === "ERROR"
                      ? "text-red-500"
                      : log.level === "WARN"
                        ? "text-yellow-500"
                        : "text-slate-500"
                  }`}>
                    [{log.level.padEnd(5)}]
                  </span>
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

function ProgressCard({
  title,
  icon: Icon,
  total,
  processed,
  failed,
  progress,
  isRunning,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  total: number;
  processed: number;
  failed: number;
  progress: number;
  isRunning: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{title}</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{progress}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              failed > 0 && progress === 100
                ? "bg-amber-500"
                : progress === 100
                  ? "bg-emerald-500"
                  : "bg-primary"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {processed} processed
          </span>
          <span>of {total} total</span>
          {failed > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <XCircle className="h-3 w-3" />
              {failed} failed
            </span>
          )}
          {isRunning && (
            <span className="flex items-center gap-1 text-blue-500 ml-auto">
              <Loader2 className="h-3 w-3 animate-spin" />
              In progress
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
    PENDING: {
      label: "Pending",
      icon: Clock,
      className: "bg-muted text-muted-foreground border-transparent",
    },
    RUNNING: {
      label: "Running",
      icon: Loader2,
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    },
    COMPLETED: {
      label: "Completed",
      icon: CheckCircle2,
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    },
    COMPLETED_WITH_ERRORS: {
      label: "Completed with Errors",
      icon: AlertTriangle,
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    },
    FAILED: {
      label: "Failed",
      icon: XCircle,
      className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
    },
    CANCELLED: {
      label: "Cancelled",
      icon: XCircle,
      className: "bg-muted text-muted-foreground border-transparent",
    },
  };
  const c = config[status] || { label: status, icon: Clock, className: "bg-muted text-muted-foreground border-transparent" };
  const IconComp = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${c.className}`}>
      <IconComp className={`h-3 w-3 ${status === "RUNNING" ? "animate-spin" : ""}`} />
      {c.label}
    </span>
  );
}
