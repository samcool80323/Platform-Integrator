import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
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
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
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
          title="Total Migrations"
          value={stats.total}
          icon={Layers}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <StatCard
          title="Running"
          value={stats.running}
          icon={Loader2}
          iconColor="text-blue-500"
          iconBg="bg-blue-500/10"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          title="Failed"
          value={stats.failed}
          icon={XCircle}
          iconColor="text-red-500"
          iconBg="bg-red-500/10"
        />
      </div>

      {/* Migration list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Migrations</CardTitle>
          {migrations.length > 0 && (
            <span className="text-sm text-muted-foreground">
              Showing last {migrations.length}
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
                    className="group flex items-center gap-4 rounded-lg border border-border p-4 transition-all hover:border-primary/30 hover:bg-accent/50 hover:shadow-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate">
                          {m.connectorId}
                        </p>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                        <p className="text-muted-foreground truncate">
                          {m.ghlLocationName}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {m.processedContacts}/{m.totalContacts} contacts
                          {m.totalContacts > 0 && ` (${progress}%)`}
                        </span>
                        <span className="text-xs text-muted-foreground/40">
                          {m.createdAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={m.status} />
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
    <div className="py-16 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <ArrowRightLeft className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        No migrations yet
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Get started by creating your first migration. You&apos;ll be guided
        through connecting your source platform and mapping fields to
        GoHighLevel.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <Link href="/migrations/new">
          <Button size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            Create Your First Migration
          </Button>
        </Link>
        <Link href="/settings" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Settings className="h-3.5 w-3.5" />
          Or set up your GHL connection first
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PENDING: {
      label: "Pending",
      className: "bg-muted text-muted-foreground border-transparent",
    },
    RUNNING: {
      label: "Running",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    },
    COMPLETED: {
      label: "Completed",
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    },
    COMPLETED_WITH_ERRORS: {
      label: "Partial",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    },
    FAILED: {
      label: "Failed",
      className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
    },
    CANCELLED: {
      label: "Cancelled",
      className: "bg-muted text-muted-foreground border-transparent",
    },
    PAUSED: {
      label: "Paused",
      className: "bg-muted text-muted-foreground border-transparent",
    },
  };
  const c = config[status] || { label: status, className: "bg-muted text-muted-foreground border-transparent" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}
