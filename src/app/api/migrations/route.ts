import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptJson } from "@/lib/encryption";
import { z } from "zod";

const createMigrationSchema = z.object({
  connectorId: z.string(),
  credentials: z.record(z.string(), z.string()),
  credentialLabel: z.string(),
  ghlLocationId: z.string(),
  ghlLocationName: z.string(),
  fieldMappings: z.array(
    z.object({
      sourceField: z.string(),
      targetField: z.string(),
      targetType: z.enum(["standard", "custom"]),
      transform: z.string().optional(),
    })
  ),
  options: z.record(z.string(), z.boolean()).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const migrations = await prisma.migration.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ migrations });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createMigrationSchema.parse(body);

    // Create or reuse connector credential
    const connectorCredential = await prisma.connectorCredential.create({
      data: {
        connectorId: data.connectorId,
        label: data.credentialLabel,
        credentials: encryptJson(data.credentials),
      },
    });

    const migration = await prisma.migration.create({
      data: {
        userId: session.user.id,
        connectorId: data.connectorId,
        connectorCredentialId: connectorCredential.id,
        ghlLocationId: data.ghlLocationId,
        ghlLocationName: data.ghlLocationName,
        fieldMappings: data.fieldMappings as unknown as import("@prisma/client").Prisma.InputJsonValue,
        options: (data.options || {}) as unknown as import("@prisma/client").Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ migration }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to create migration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
