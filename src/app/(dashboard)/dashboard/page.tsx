import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  ArrowRightLeft,
  CheckCircle2,
  ArrowRight,
  Loader2,
  XCircle,
  Settings,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const migrations = await prisma.migration.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const stats = {
    total: migrations.length,
    running: migrations.filter((m) => m.status === "RUNNING").length,
    completed: migrations.filter(
      (m) => m.status === "COMPLETED" || m.status === "COMPLETED_WITH_ERRORS"
    ).length,
    failed: migrations.filter((m) => m.status === "FAILED").length,
  };

  return (
    <div className="space-y-8 stagger-children">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] text-foreground">Dashboard</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Track and manage your CRM data migrations
          </p>
        </div>
        <Link href="/migrations/new">
          <Button size="lg" className="gap-2" variant="accent">
            <Plus className="h-4 w-4" />
            New Migration
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total" value={stats.total} accent={false} />
        <StatCard
          title="Running"
          value={stats.running}
          accent={stats.running > 0}
          live={stats.running > 0}
        />
        <StatCard title="Completed" value={stats.completed} variant="success" />
        <StatCard title="Failed" value={stats.failed} variant="destructive" />
      </div>

      {/* Migration list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-foreground">
            Recent Migrations
          </h2>
          {migrations.length > 0 && (
            <span className="text-[13px] text-muted-foreground">
              {migrations.length} total
            </span>
          )}
        </div>

        {migrations.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-1.5">
            {migrations.map((m) => {
              const progress =
                m.totalContacts > 0
                  ? Math.round(
                      (m.processedContacts / m.totalContacts) * 100
                    )
                  : 0;
              return (
                <Link
                  key={m.id}
                  href={`/migrations/${m.id}`}
                  className="group flex items-center gap-4 rounded-lg border border-transparent bg-card p-3.5 transition-all duration-150 hover:border-border hover:shadow-card"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary transition-colors duration-150 group-hover:bg-accent">
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground transition-colors duration-150 group-hover:text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[14px] text-foreground truncate capitalize">
                        {m.connectorId}
                      </p>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                      <p className="text-muted-foreground truncate text-[13px]">
                        {m.ghlLocationName}
                      </p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      {m.totalContacts > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-16 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${progress}%`,
                                background:
                                  progress === 100
                                    ? "var(--success)"
                                    : "var(--ring)",
                              }}
                            />
                          </div>
                          <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
                            {progress}%
                          </span>
                        </div>
                      )}
                      <span className="text-[12px] text-muted-foreground/50">
                        {m.createdAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <StatusPill status={m.status} />
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-all duration-150 shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
          <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="text-[15px] font-semibold text-foreground">
          No migrations yet
        </h3>
        <p className="mx-auto mt-1.5 max-w-[300px] text-[13px] text-muted-foreground leading-relaxed">
          Connect a source platform, map your fields, and import everything
          into GoHighLevel.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2.5">
          <Link href="/migrations/new">
            <Button size="lg" variant="accent" className="gap-2">
              <Plus className="h-4 w-4" />
              Create First Migration
            </Button>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Set up GHL connection first
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  title,
  value,
  accent,
  live,
  variant,
}: {
  title: string;
  value: number;
  accent?: boolean;
  live?: boolean;
  variant?: "success" | "destructive";
}) {
  const valueColor =
    variant === "success" && value > 0
      ? "text-success"
      : variant === "destructive" && value > 0
        ? "text-destructive"
        : accent
          ? "text-accent-foreground"
          : "text-foreground";

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted-foreground">{title}</span>
        {live && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-accent-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-foreground opacity-50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-foreground" />
            </span>
            Live
          </span>
        )}
      </div>
      <p className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${valueColor}`}>
        {value}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PENDING: {
      label: "Pending",
      className: "bg-secondary text-muted-foreground",
    },
    RUNNING: {
      label: "Running",
      className: "bg-accent text-accent-foreground",
    },
    COMPLETED: {
      label: "Done",
      className: "bg-success/10 text-success",
    },
    COMPLETED_WITH_ERRORS: {
      label: "Partial",
      className: "bg-warning/10 text-warning",
    },
    FAILED: {
      label: "Failed",
      className: "bg-destructive/8 text-destructive",
    },
    CANCELLED: {
      label: "Cancelled",
      className: "bg-secondary text-muted-foreground",
    },
    PAUSED: {
      label: "Review",
      className: "bg-warning/10 text-warning",
    },
  };
  const c = config[status] || {
    label: status,
    className: "bg-secondary text-muted-foreground",
  };
  return (
    <span
      className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-semibold ${c.className}`}
    >
      {status === "RUNNING" && (
        <span className="relative mr-1.5 flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-50" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {c.label}
    </span>
  );
}
