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

    let es: EventSource | null = new EventSource(`/api/events?migrationId=${migrationId}`);
    es.onmessage = () => { loadMigration(); loadLogs(); };
    es.onerror = () => {
      es?.close();
      es = null;
      setTimeout(() => {
        if (document.visibilityState !== "hidden") {
          loadMigration();
          loadLogs();
        }
      }, 3000);
    };

    const poll = setInterval(() => { loadMigration(); loadLogs(); }, 10000);

    return () => { es?.close(); clearInterval(poll); };
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

  const [pushing, setPushing] = useState(false);

  async function handlePushAll() {
    setPushing(true);
    await fetch(`/api/migrations/${migrationId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pushAll: true }),
    });
    loadMigration();
  }

  if (loading || !migration) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-accent-foreground" />
        <span className="text-[13px]">Loading migration...</span>
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
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb + Header */}
      <div>
        <Link href="/dashboard"
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>

        <div className="flex items-start justify-between mt-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[22px] text-foreground">Migration</h1>
              <StatusPill status={migration.status} />
            </div>
            <p className="mt-1 text-[14px] text-muted-foreground capitalize">
              {migration.connectorId} <span className="text-muted-foreground/30 mx-1">&rarr;</span> {migration.ghlLocationName}
            </p>
            {migration.startedAt && (
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground/60 tabular-nums">
                <Clock className="h-3 w-3" />
                Started {new Date(migration.startedAt).toLocaleString()}
                {migration.completedAt && <> &middot; Done {new Date(migration.completedAt).toLocaleString()}</>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPaused && (
              <Button size="sm" onClick={handlePushAll} disabled={pushing} variant="accent" className="gap-2">
                {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {pushing ? "Starting..." : "Push All Contacts"}
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

      {/* Running banner */}
      {isRunning && (
        <div className="rounded-lg border border-accent-foreground/15 bg-accent p-3.5 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-accent-foreground shrink-0" />
          <div className="text-[13px]">
            <span className="font-medium text-foreground">Migration is running.</span>{" "}
            <span className="text-muted-foreground">You can navigate away &mdash; it will keep going.</span>
          </div>
        </div>
      )}

      {/* Paused review banner */}
      {isPaused && (
        <div className="rounded-lg border border-warning/20 bg-warning-light p-4 space-y-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-warning">
            <Pause className="h-4 w-4" />
            Test import complete &mdash; review before continuing
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {migration.processedContacts} test contacts have been imported into your GHL sub-account.
            Check them in GoHighLevel to make sure names, phone numbers, tags, and custom fields look correct.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePushAll} disabled={pushing} variant="accent" className="gap-2">
              {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {pushing ? "Starting..." : "Looks good \u2014 push all contacts"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.history.back()} className="gap-2">
              Go back and adjust
            </Button>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ProgressCard title="Contacts" icon={Users} total={migration.totalContacts}
          processed={migration.processedContacts} failed={migration.failedContacts}
          progress={contactProgress} isRunning={isRunning} />
        <ProgressCard title="Conversations" icon={MessageSquare} total={migration.totalConversations}
          processed={migration.processedConversations} failed={migration.failedConversations}
          progress={convProgress} isRunning={isRunning} />
      </div>

      {/* Logs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[15px] font-semibold text-foreground">Log</h2>
            <span className="text-[12px] text-muted-foreground">
              {isRunning ? "Live" : `${logs.length} entries`}
            </span>
          </div>
          <Button variant="ghost" size="xs" onClick={loadLogs} className="gap-1.5">
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </div>

        <div
          className="max-h-[400px] overflow-y-auto rounded-lg border border-border p-4 font-mono text-[12px] leading-[1.7] bg-card"
        >
          {logs.length === 0 ? (
            <p className="text-muted-foreground/40 py-8 text-center text-[13px] font-sans">
              {isRunning ? "Waiting for log entries..." : "No logs for this migration."}
            </p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={`log-line py-px ${
                log.level === "ERROR" ? "text-destructive"
                  : log.level === "WARN" ? "text-warning"
                    : "text-muted-foreground"
              }`}>
                <span className="text-muted-foreground/25 select-none mr-2">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`mr-2 font-semibold ${
                  log.level === "ERROR" ? "text-destructive"
                    : log.level === "WARN" ? "text-warning"
                      : "text-muted-foreground/30"
                }`}>
                  [{log.level.padEnd(5)}]
                </span>
                <span className="text-foreground/80">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ title, icon: Icon, total, processed, failed, progress, isRunning }: {
  title: string; icon: React.ComponentType<{ className?: string }>; total: number;
  processed: number; failed: number; progress: number; isRunning: boolean;
}) {
  const barColor =
    failed > 0 && progress === 100
      ? "var(--warning)"
      : progress === 100
        ? "var(--success)"
        : "var(--ring)";

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-[13px] font-medium text-foreground">{title}</span>
        </div>
        <span className="text-xl font-bold text-foreground tracking-tight tabular-nums">{progress}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${isRunning ? "progress-active" : ""}`}
          style={{ width: `${progress}%`, background: barColor }}
        />
      </div>
      <div className="mt-2.5 flex items-center gap-3 text-[12px] text-muted-foreground tabular-nums">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-success" /> {processed}
        </span>
        <span>of {total}</span>
        {failed > 0 && (
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="h-3 w-3" /> {failed}
          </span>
        )}
        {isRunning && (
          <span className="flex items-center gap-1 text-accent-foreground ml-auto">
            <Loader2 className="h-3 w-3 animate-spin" /> Running
          </span>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
    PENDING: { label: "Pending", icon: Clock, className: "bg-secondary text-muted-foreground" },
    RUNNING: { label: "Running", icon: Loader2, className: "bg-accent text-accent-foreground" },
    COMPLETED: { label: "Done", icon: CheckCircle2, className: "bg-success/10 text-success" },
    COMPLETED_WITH_ERRORS: { label: "Partial", icon: AlertTriangle, className: "bg-warning/10 text-warning" },
    FAILED: { label: "Failed", icon: XCircle, className: "bg-destructive/8 text-destructive" },
    PAUSED: { label: "Review", icon: Pause, className: "bg-warning/10 text-warning" },
    CANCELLED: { label: "Cancelled", icon: XCircle, className: "bg-secondary text-muted-foreground" },
  };
  const c = config[status] || { label: status, icon: Clock, className: "bg-secondary text-muted-foreground" };
  const IconComp = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-semibold ${c.className}`}>
      <IconComp className={`h-3 w-3 ${status === "RUNNING" ? "animate-spin" : ""}`} />
      {c.label}
    </span>
  );
}
