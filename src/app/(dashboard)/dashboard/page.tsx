import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  ArrowRightLeft,
  CheckCircle2,
  ArrowRight,
  Layers,
  Loader2,
  XCircle,
  Settings,
  TrendingUp,
  Zap,
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Dashboard
            </h1>
            {stats.running > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                </span>
                {stats.running} running
              </span>
            )}
          </div>
          <p className="mt-1.5 text-muted-foreground">
            Track and manage your CRM data migrations
          </p>
        </div>
        <Link href="/migrations/new">
          <Button size="lg" className="gap-2 gradient-primary border-0 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:opacity-90 transition-all">
            <Plus className="h-4 w-4" />
            New Migration
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total"
          value={stats.total}
          icon={Layers}
          gradientClass="from-zinc-500/10 to-zinc-600/5"
          iconClass="text-zinc-600 dark:text-zinc-400"
        />
        <StatCard
          title="Running"
          value={stats.running}
          icon={Zap}
          gradientClass="from-indigo-500/10 to-violet-500/5"
          iconClass="text-indigo-600 dark:text-indigo-400"
          pulse={stats.running > 0}
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          gradientClass="from-emerald-500/10 to-teal-500/5"
          iconClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          title="Failed"
          value={stats.failed}
          icon={XCircle}
          gradientClass="from-red-500/10 to-rose-500/5"
          iconClass="text-red-600 dark:text-red-400"
        />
      </div>

      {/* Migration list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Migrations</CardTitle>
          {migrations.length > 0 && (
            <span className="text-sm text-muted-foreground">
              Last {migrations.length}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {migrations.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {migrations.map((m) => {
                const progress = m.totalContacts > 0
                  ? Math.round((m.processedContacts / m.totalContacts) * 100)
                  : 0;
                return (
                  <Link
                    key={m.id}
                    href={`/migrations/${m.id}`}
                    className="group flex items-center gap-4 rounded-xl border border-border p-4 transition-all duration-200 hover:shadow-card-hover hover:border-indigo-500/20"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-500/10 to-zinc-600/5 group-hover:from-indigo-500/15 group-hover:to-violet-500/10 transition-all duration-300">
                      <ArrowRightLeft className="h-4 w-4 text-zinc-500 group-hover:text-indigo-500 transition-colors duration-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground truncate capitalize">
                          {m.connectorId}
                        </p>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                        <p className="text-muted-foreground truncate text-sm">
                          {m.ghlLocationName}
                        </p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        {m.totalContacts > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${progress}%`,
                                  background: progress === 100
                                    ? "linear-gradient(90deg, #059669, #10b981)"
                                    : "linear-gradient(90deg, #4f46e5, #6366f1)",
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">{progress}%</span>
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground/40">
                          {m.createdAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <StatusPill status={m.status} />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-lg shadow-indigo-500/25">
        <ArrowRightLeft className="h-7 w-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-foreground tracking-tight">
        No migrations yet
      </h3>
      <p className="mx-auto mt-2 max-w-[340px] text-sm text-muted-foreground leading-relaxed">
        Start by creating a migration. You&apos;ll connect a source platform,
        map fields, and import everything into GoHighLevel.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link href="/migrations/new">
          <Button size="lg" className="gap-2 gradient-primary border-0 shadow-lg shadow-indigo-500/20">
            <Plus className="h-4 w-4" />
            Create First Migration
          </Button>
        </Link>
        <Link href="/settings" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent-foreground transition-colors">
          <Settings className="h-3.5 w-3.5" />
          Set up GHL connection first
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  gradientClass,
  iconClass,
  pulse,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  gradientClass: string;
  iconClass: string;
  pulse?: boolean;
}) {
  return (
    <Card className="group hover:shadow-card-hover transition-all duration-300">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradientClass}`}>
          <Icon className={`h-5 w-5 ${iconClass}`} />
          {pulse && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-500" />
            </span>
          )}
        </div>
        <div>
          <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-muted text-muted-foreground" },
    RUNNING: { label: "Running", className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
    COMPLETED: { label: "Done", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    COMPLETED_WITH_ERRORS: { label: "Partial", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    FAILED: { label: "Failed", className: "bg-red-500/10 text-red-600 dark:text-red-400" },
    CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
    PAUSED: { label: "Paused", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  };
  const c = config[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`shrink-0 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${c.className}`}>
      {status === "RUNNING" && (
        <span className="relative mr-1.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
        </span>
      )}
      {c.label}
    </span>
  );
}
