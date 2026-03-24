import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/encryption";
import { getConnector } from "@/lib/connectors/registry";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connectorId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { connectorId } = await params;
  const connector = getConnector(connectorId);
  if (!connector) {
    return NextResponse.json({ error: "Connector not found" }, { status: 404 });
  }

  const body = await req.json();
  let credentials: Record<string, string> = body.credentials || {};

  // If a saved credentialId is provided, load credentials from DB
  if (body.credentialId) {
    const record = await prisma.connectorCredential.findFirst({
      where: { id: body.credentialId, userId: session.user.id },
    });
    if (!record) {
      return NextResponse.json({ error: "Saved account not found" }, { status: 404 });
    }
    credentials = decryptJson<Record<string, string>>(record.credentials);
  }

  const result = await connector.validateCredentials(credentials);
  return NextResponse.json(result);
}
