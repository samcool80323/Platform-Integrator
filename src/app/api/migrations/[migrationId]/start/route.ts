import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MigrationEngine } from "@/lib/migration/engine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ migrationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { migrationId } = await params;

  const migration = await prisma.migration.findUnique({
    where: { id: migrationId, userId: session.user.id },
  });

  if (!migration) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (migration.status !== "PENDING" && migration.status !== "FAILED") {
    return NextResponse.json(
      { error: `Cannot start migration in ${migration.status} status` },
      { status: 400 }
    );
  }

  // Start the migration in the background
  // In production, this would use BullMQ. For now, we run it directly.
  const engine = new MigrationEngine(migrationId);
  engine.run().catch((error) => {
    console.error(`Migration ${migrationId} failed:`, error);
  });

  return NextResponse.json({ message: "Migration started" }, { status: 202 });
}
