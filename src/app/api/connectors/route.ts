import { NextResponse } from "next/server";
import { listConnectors } from "@/lib/connectors/registry";

export async function GET() {
  const connectors = listConnectors().map((c) => ({
    id: c.id,
    name: c.name,
    logo: c.logo,
    description: c.description,
    authConfig: c.authConfig,
    capabilities: c.capabilities,
  }));

  return NextResponse.json({ connectors });
}
