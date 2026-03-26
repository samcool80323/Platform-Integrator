import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/encryption";
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

    const fields = await connector.discoverFields(credentials);

    // Always auto-map all discovered fields first, then overlay connector defaults
    const autoMapped = autoMapFields(fields);
    const defaults = connector.getDefaultFieldMapping();

    // Defaults take priority — override auto-mapped entries
    const defaultKeys = new Set(defaults.map((d) => d.sourceField));
    const mappings = [
      ...defaults,
      ...autoMapped.filter((m) => !defaultKeys.has(m.sourceField)),
    ];

    // Ensure every mapped field has a corresponding field entry.
    // Default mappings (e.g. email) may reference fields not in the sample data.
    const fieldKeys = new Set(fields.map((f) => f.key));
    for (const mapping of mappings) {
      if (!fieldKeys.has(mapping.sourceField) && mapping.sourceField !== "_samplePayload") {
        fields.push({
          key: mapping.sourceField,
          label: mapping.sourceField
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, (c: string) => c.toUpperCase()),
          type: mapping.targetField === "email" ? "email"
            : mapping.targetField === "phone" ? "phone"
            : "text",
          isStandard: mapping.targetType === "standard",
        });
        fieldKeys.add(mapping.sourceField);
      }
    }

    return NextResponse.json({ fields, mappings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
