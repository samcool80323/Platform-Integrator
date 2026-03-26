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
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Track and manage your CRM data migrations
          </p>
        </div>
        <Link href="/migrations/new">
          <Button size="lg" className="gap-2">
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
          accentClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        />
        <StatCard
          title="Running"
          value={stats.running}
          icon={Loader2}
          accentClass="bg-orange-500/10 text-orange-600 dark:text-orange-400"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          accentClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          title="Failed"
          value={stats.failed}
          icon={XCircle}
          accentClass="bg-red-500/10 text-red-600 dark:text-red-400"
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
                    className="group flex items-center gap-4 rounded-xl border border-border p-4 transition-all duration-200 hover:shadow-card-hover hover:border-primary/20"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                      <ArrowRightLeft className="h-4 w-4 text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground truncate capitalize">
                          {m.connectorId}
                        </p>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        <p className="text-muted-foreground truncate text-sm">
                          {m.ghlLocationName}
                        </p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        {m.totalContacts > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-violet-500 transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{progress}%</span>
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground/50">
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
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-lg shadow-violet-500/20">
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
          <Button size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            Create First Migration
          </Button>
        </Link>
        <Link href="/settings" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
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
  accentClass,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${accentClass}`}>
          <Icon className="h-5 w-5" />
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
    RUNNING: { label: "Running", className: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
    COMPLETED: { label: "Done", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    COMPLETED_WITH_ERRORS: { label: "Partial", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    FAILED: { label: "Failed", className: "bg-red-500/10 text-red-600 dark:text-red-400" },
    CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
    PAUSED: { label: "Paused", className: "bg-muted text-muted-foreground" },
  };
  const c = config[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`shrink-0 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${c.className}`}>
      {c.label}
    </span>
  );
}
