import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getConnector } from "@/lib/connectors/registry";
import { autoMapFields } from "@/lib/connectors/base";

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

  try {
    const body = await req.json();
    const fields = await connector.discoverFields(body.credentials || {});

    // Get default mappings from connector, fallback to auto-mapping
    let mappings = connector.getDefaultFieldMapping();
    if (mappings.length === 0) {
      mappings = autoMapFields(fields);
    }

    return NextResponse.json({ fields, mappings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
