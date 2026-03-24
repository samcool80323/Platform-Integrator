import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
  const result = await connector.validateCredentials(body.credentials || {});

  return NextResponse.json(result);
}
