import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowRightLeft, CheckCircle2, AlertCircle, Clock } from "lucide-react";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
          <p className="text-sm text-neutral-500">
            Manage your CRM data migrations
          </p>
        </div>
        <Link href="/migrations/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Migration
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total" value={stats.total} icon={ArrowRightLeft} />
        <StatCard title="Running" value={stats.running} icon={Clock} />
        <StatCard title="Completed" value={stats.completed} icon={CheckCircle2} />
        <StatCard title="Failed" value={stats.failed} icon={AlertCircle} />
      </div>

      {/* Migration list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Migrations</CardTitle>
        </CardHeader>
        <CardContent>
          {migrations.length === 0 ? (
            <div className="py-12 text-center">
              <ArrowRightLeft className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
              <p className="text-neutral-500">No migrations yet</p>
              <p className="text-sm text-neutral-400">
                Create your first migration to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {migrations.map((m) => (
                <Link
                  key={m.id}
                  href={`/migrations/${m.id}`}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-neutral-50"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium text-neutral-900">
                        {m.connectorId} → {m.ghlLocationName}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {m.processedContacts} / {m.totalContacts} contacts
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={m.status} />
                    <span className="text-xs text-neutral-400">
                      {m.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="rounded-lg bg-neutral-100 p-2">
          <Icon className="h-5 w-5 text-neutral-600" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-neutral-500">{title}</p>
        </div>
      </CardContent>
    </Card>
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
    PAUSED: { label: "Paused", variant: "outline" },
  };
  const c = config[status] || { label: status, variant: "outline" as const };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}
