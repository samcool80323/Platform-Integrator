import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptJson } from "@/lib/encryption";
import { z } from "zod";

const createMigrationSchema = z.object({
  connectorId: z.string(),
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

  // Either provide a saved credential ID (reuse) OR raw credentials (create new)
  credentialId: z.string().optional(),
  credentials: z.record(z.string(), z.string()).optional(),
  credentialLabel: z.string().optional(),
  saveCredentials: z.boolean().optional(), // whether to save new creds for future reuse
}).refine(
  (d) => d.credentialId || (d.credentials && Object.keys(d.credentials).length > 0),
  { message: "Either credentialId or credentials must be provided" }
);

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const migrations = await prisma.migration.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      connectorCredential: {
        select: { id: true, label: true, connectorId: true },
      },
    },
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

    let connectorCredentialId: string;

    if (data.credentialId) {
      // Reuse an existing saved credential — verify it belongs to this user
      const existing = await prisma.connectorCredential.findFirst({
        where: { id: data.credentialId, userId: session.user.id },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Saved account not found or access denied" },
          { status: 404 }
        );
      }
      connectorCredentialId = existing.id;
    } else {
      // Create a new credential record
      const newCred = await prisma.connectorCredential.create({
        data: {
          userId: session.user.id,
          connectorId: data.connectorId,
          label: data.credentialLabel || `${data.connectorId} account`,
          credentials: encryptJson(data.credentials!),
          isValid: true,
          lastValidated: new Date(),
        },
      });
      connectorCredentialId = newCred.id;
    }

    const migration = await prisma.migration.create({
      data: {
        userId: session.user.id,
        connectorId: data.connectorId,
        connectorCredentialId,
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
