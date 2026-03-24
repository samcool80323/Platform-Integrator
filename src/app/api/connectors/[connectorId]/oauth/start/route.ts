import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/encryption";
import { getConnector } from "@/lib/connectors/registry";
import crypto from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ connectorId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { connectorId } = await params;
  const connector = getConnector(connectorId);

  if (!connector) {
    return NextResponse.json({ error: "Connector not found" }, { status: 404 });
  }

  if (connector.authConfig.type !== "oauth2") {
    return NextResponse.json({ error: "Connector does not use OAuth2" }, { status: 400 });
  }

  // Load this user's OAuth app credentials from DB
  const oauthApp = await prisma.connectorOAuthApp.findUnique({
    where: { userId_connectorId: { userId: session.user.id, connectorId } },
  });

  if (!oauthApp) {
    // Redirect back to settings with a clear error
    const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "";
    return NextResponse.redirect(
      `${baseUrl}/settings?oauth_setup_needed=${connectorId}`
    );
  }

  const clientId = decrypt(oauthApp.clientId);
  const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const redirectUri = oauthApp.redirectUri || `${baseUrl}/api/connectors/${connectorId}/oauth/callback`;

  // Generate CSRF state token
  const state = crypto.randomBytes(24).toString("hex");

  const authUrl = new URL(connector.authConfig.authorizationUrl!);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", (connector.authConfig.scopes || []).join(" "));
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString());

  // Store state in an encrypted cookie for CSRF validation in callback
  const cookiePayload = encrypt(JSON.stringify({ state, userId: session.user.id, connectorId }));
  response.cookies.set(`oauth_state_${connectorId}`, cookiePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
