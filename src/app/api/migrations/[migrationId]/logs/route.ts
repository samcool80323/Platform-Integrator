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
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

  const logs = await prisma.migrationLog.findMany({
    where: { migrationId },
    orderBy: { timestamp: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json({ logs });
}
