import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptJson, decryptJson } from "@/lib/encryption";
import { getConnector } from "@/lib/connectors/registry";
import { z } from "zod";

const SaveSchema = z.object({
  connectorId: z.string().min(1),
  label: z.string().min(1, "Please give this account a name"),
  credentials: z.record(z.string(), z.string()),
});

// GET /api/connected-accounts?connectorId=podium
// Returns saved accounts for current user (optionally filtered by connector)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectorId = req.nextUrl.searchParams.get("connectorId");

  const accounts = await prisma.connectorCredential.findMany({
    where: {
      userId: session.user.id,
      ...(connectorId ? { connectorId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      connectorId: true,
      label: true,
      isValid: true,
      lastValidated: true,
      createdAt: true,
      updatedAt: true,
      // Never return raw credentials
    },
  });

  return NextResponse.json({ accounts });
}

// POST /api/connected-accounts
// Save a new set of credentials with a label
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = SaveSchema.parse(await req.json());
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Validate credentials before saving
  const connector = getConnector(body.connectorId);
  if (!connector) {
    return NextResponse.json({ error: "Unknown connector" }, { status: 404 });
  }

  const validation = await connector.validateCredentials(body.credentials);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error || "Credentials are invalid" },
      { status: 400 }
    );
  }

  const account = await prisma.connectorCredential.create({
    data: {
      userId: session.user.id,
      connectorId: body.connectorId,
      label: body.label,
      credentials: encryptJson(body.credentials),
      isValid: true,
      lastValidated: new Date(),
    },
    select: {
      id: true,
      connectorId: true,
      label: true,
      isValid: true,
      lastValidated: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ account }, { status: 201 });
}

// Export helper for internal use (getting decrypted credentials by ID + userId)
export async function getCredentialsForUser(
  credentialId: string,
  userId: string
): Promise<Record<string, string> | null> {
  const record = await prisma.connectorCredential.findFirst({
    where: { id: credentialId, userId },
  });
  if (!record) return null;
  try {
    return decryptJson(record.credentials) as Record<string, string>;
  } catch {
    return null;
  }
}
