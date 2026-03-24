import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/encryption";
import { getConnector } from "@/lib/connectors/registry";

// DELETE /api/connected-accounts/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Only delete if it belongs to this user
  const deleted = await prisma.connectorCredential.deleteMany({
    where: { id, userId: session.user.id },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// POST /api/connected-accounts/[id]/revalidate
// Re-test stored credentials and update isValid
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const record = await prisma.connectorCredential.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!record) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const connector = getConnector(record.connectorId);
  if (!connector) {
    return NextResponse.json({ error: "Connector not found" }, { status: 404 });
  }

  let credentials: Record<string, string>;
  try {
    credentials = decryptJson(record.credentials) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "Failed to decrypt credentials" }, { status: 500 });
  }

  const result = await connector.validateCredentials(credentials);

  await prisma.connectorCredential.update({
    where: { id },
    data: { isValid: result.valid, lastValidated: new Date() },
  });

  return NextResponse.json({ valid: result.valid, error: result.error });
}
