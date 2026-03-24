import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
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
    include: {
      _count: {
        select: {
          records: true,
        },
      },
    },
  });

  if (!migration) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ migration });
}
