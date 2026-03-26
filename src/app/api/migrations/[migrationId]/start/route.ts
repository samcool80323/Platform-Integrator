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

  if (migration.status !== "PENDING" && migration.status !== "FAILED" && migration.status !== "PAUSED") {
    return NextResponse.json(
      { error: `Cannot start migration in ${migration.status} status` },
      { status: 400 }
    );
  }

  // Parse optional testLimit from body (if present)
  let testLimit: number | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (body.testLimit) testLimit = Number(body.testLimit);
    if (body.pushAll) testLimit = undefined; // no limit — push everything
  } catch {
    // no body is fine
  }

  const engine = new MigrationEngine(migrationId);
  engine.run(testLimit).catch((error) => {
    console.error(`Migration ${migrationId} failed:`, error);
  });

  return NextResponse.json({
    message: testLimit ? `Test migration started (${testLimit} contacts)` : "Migration started",
  }, { status: 202 });
}
