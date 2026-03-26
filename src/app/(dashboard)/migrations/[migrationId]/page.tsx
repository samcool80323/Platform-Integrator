"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Pause,
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
    eventSource.onmessage = () => { loadMigration(); };
    eventSource.onerror = () => { eventSource.close(); };
    return () => eventSource.close();
  }, [migrationId]);

  async function loadMigration() {
    const res = await fetch(`/api/migrations/${migrationId}`);
    if (res.ok) { const data = await res.json(); setMigration(data.migration); }
    setLoading(false);
  }

  async function loadLogs() {
    const res = await fetch(`/api/migrations/${migrationId}/logs`);
    if (res.ok) { const data = await res.json(); setLogs(data.logs || []); }
  }

  async function handleRetry() {
    await fetch(`/api/migrations/${migrationId}/start`, { method: "POST" });
    loadMigration();
  }

  async function handlePushAll() {
    await fetch(`/api/migrations/${migrationId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pushAll: true }),
    });
    loadMigration();
  }

  if (loading || !migration) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Loading...
      </div>
    );
  }

  const contactProgress = migration.totalContacts > 0
    ? Math.round((migration.processedContacts / migration.totalContacts) * 100) : 0;
  const convProgress = migration.totalConversations > 0
    ? Math.round((migration.processedConversations / migration.totalConversations) * 100) : 0;
  const isRunning = migration.status === "RUNNING";
  const isPaused = migration.status === "PAUSED";
  const isFailed = migration.status === "FAILED" || migration.status === "COMPLETED_WITH_ERRORS";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>

        <div className="flex items-start justify-between mt-2">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Migration</h1>
              <StatusPill status={migration.status} />
            </div>
            <p className="mt-1 text-muted-foreground capitalize">
              {migration.connectorId} → {migration.ghlLocationName}
            </p>
            {migration.startedAt && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Started {new Date(migration.startedAt).toLocaleString()}
                {migration.completedAt && <> · Done {new Date(migration.completedAt).toLocaleString()}</>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPaused && (
              <Button size="sm" onClick={handlePushAll} className="gap-2">
                <ArrowRight className="h-4 w-4" /> Push All Contacts
              </Button>
            )}
            {isFailed && (
              <Button variant="outline" size="sm" onClick={handleRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Paused review banner */}
      {isPaused && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
            <Pause className="h-4 w-4" />
            Test import complete — review before continuing
          </div>
          <p className="text-sm text-muted-foreground">
            {migration.processedContacts} test contacts have been imported into your GHL sub-account.
            Check them in GoHighLevel to make sure the data looks correct — names, phone numbers, tags, custom fields, etc.
          </p>
          <div className="flex gap-3">
            <Button size="sm" onClick={handlePushAll} className="gap-2">
              <ArrowRight className="h-4 w-4" /> Looks good — push all contacts
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.history.back()} className="gap-2">
              Go back and adjust mapping
            </Button>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ProgressCard title="Contacts" icon={Users} total={migration.totalContacts}
          processed={migration.processedContacts} failed={migration.failedContacts}
          progress={contactProgress} isRunning={isRunning} />
        <ProgressCard title="Conversations" icon={MessageSquare} total={migration.totalConversations}
          processed={migration.processedConversations} failed={migration.failedConversations}
          progress={convProgress} isRunning={isRunning} />
      </div>

      {/* Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4 text-muted-foreground" /> Log
            </CardTitle>
            <CardDescription>
              {isRunning ? "Live updates" : `${logs.length} entries`}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadLogs} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="max-h-[420px] space-y-0.5 overflow-y-auto rounded-xl p-4 font-mono text-xs leading-relaxed"
            style={{ background: "#09090b" }}>
            {logs.length === 0 ? (
              <p className="text-white/10 py-6 text-center">
                {isRunning ? "Waiting for log entries..." : "No logs for this migration."}
              </p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className={`py-0.5 ${
                  log.level === "ERROR" ? "text-red-400"
                    : log.level === "WARN" ? "text-amber-400"
                      : "text-zinc-300"
                }`}>
                  <span className="text-white/8 select-none">
                    {new Date(log.timestamp).toLocaleTimeString()}{" "}
                  </span>
                  <span className={`mr-2 font-bold ${
                    log.level === "ERROR" ? "text-red-500"
                      : log.level === "WARN" ? "text-amber-500"
                        : "text-zinc-400/40"
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

function ProgressCard({ title, icon: Icon, total, processed, failed, progress, isRunning }: {
  title: string; icon: React.ComponentType<{ className?: string }>; total: number;
  processed: number; failed: number; progress: number; isRunning: boolean;
}) {
  const barColor = failed > 0 && progress === 100
    ? "bg-amber-500" : progress === 100 ? "bg-emerald-500" : "gradient-primary";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-zinc-600" />
            <span className="text-sm font-semibold text-foreground">{title}</span>
          </div>
          <span className="text-2xl font-bold text-foreground tracking-tight">{progress}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {processed} done
          </span>
          <span>of {total}</span>
          {failed > 0 && <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3 w-3" /> {failed} failed</span>}
          {isRunning && <span className="flex items-center gap-1 text-zinc-600 ml-auto"><Loader2 className="h-3 w-3 animate-spin" /> Running</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
    PENDING: { label: "Pending", icon: Clock, className: "bg-muted text-muted-foreground" },
    RUNNING: { label: "Running", icon: Loader2, className: "bg-zinc-500/8 text-zinc-600 dark:text-zinc-400" },
    COMPLETED: { label: "Done", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    COMPLETED_WITH_ERRORS: { label: "Partial", icon: AlertTriangle, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    FAILED: { label: "Failed", icon: XCircle, className: "bg-red-500/10 text-red-600 dark:text-red-400" },
    PAUSED: { label: "Review", icon: Pause, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    CANCELLED: { label: "Cancelled", icon: XCircle, className: "bg-muted text-muted-foreground" },
  };
  const c = config[status] || { label: status, icon: Clock, className: "bg-muted text-muted-foreground" };
  const IconComp = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${c.className}`}>
      <IconComp className={`h-3 w-3 ${status === "RUNNING" ? "animate-spin" : ""}`} />
      {c.label}
    </span>
  );
}
