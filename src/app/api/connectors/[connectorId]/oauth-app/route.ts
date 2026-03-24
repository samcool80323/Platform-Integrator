import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { getConnector } from "@/lib/connectors/registry";
import { z } from "zod";

const SaveSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client Secret is required"),
  redirectUri: z.string().url().optional().or(z.literal("")),
});

// GET — returns whether this connector OAuth app is configured (never returns secrets)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ connectorId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { connectorId } = await params;
  const connector = getConnector(connectorId);
  if (!connector || connector.authConfig.type !== "oauth2") {
    return NextResponse.json({ error: "Not an OAuth2 connector" }, { status: 404 });
  }

  const record = await prisma.connectorOAuthApp.findUnique({
    where: { userId_connectorId: { userId: session.user.id, connectorId } },
  });

  if (!record) {
    return NextResponse.json({ configured: false });
  }

  // Return only non-secret info
  const clientIdDecrypted = decrypt(record.clientId);
  return NextResponse.json({
    configured: true,
    clientIdPreview: `${clientIdDecrypted.slice(0, 6)}••••••`,
    redirectUri: record.redirectUri,
    updatedAt: record.updatedAt,
  });
}

// POST — save or update connector OAuth app credentials
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
  if (!connector || connector.authConfig.type !== "oauth2") {
    return NextResponse.json({ error: "Not an OAuth2 connector" }, { status: 404 });
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

  const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const defaultRedirectUri = `${baseUrl}/api/connectors/${connectorId}/oauth/callback`;

  await prisma.connectorOAuthApp.upsert({
    where: { userId_connectorId: { userId: session.user.id, connectorId } },
    create: {
      userId: session.user.id,
      connectorId,
      clientId: encrypt(body.clientId),
      clientSecret: encrypt(body.clientSecret),
      redirectUri: body.redirectUri || defaultRedirectUri,
    },
    update: {
      clientId: encrypt(body.clientId),
      clientSecret: encrypt(body.clientSecret),
      redirectUri: body.redirectUri || defaultRedirectUri,
    },
  });

  return NextResponse.json({ success: true, redirectUri: body.redirectUri || defaultRedirectUri });
}

// DELETE — remove connector OAuth app credentials
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ connectorId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { connectorId } = await params;

  await prisma.connectorOAuthApp.deleteMany({
    where: { userId: session.user.id, connectorId },
  });

  return NextResponse.json({ success: true });
}
