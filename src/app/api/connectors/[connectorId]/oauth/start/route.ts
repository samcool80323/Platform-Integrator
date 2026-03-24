import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getConnector } from "@/lib/connectors/registry";
import crypto from "crypto";
import { encrypt } from "@/lib/encryption";

// Map connector IDs to their env var prefixes
const CONNECTOR_ENV_PREFIX: Record<string, string> = {
  podium: "PODIUM",
};

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

  if (!connector) {
    return NextResponse.json({ error: "Connector not found" }, { status: 404 });
  }

  if (connector.authConfig.type !== "oauth2") {
    return NextResponse.json({ error: "Connector does not use OAuth2" }, { status: 400 });
  }

  const prefix = CONNECTOR_ENV_PREFIX[connectorId];
  const clientId = prefix ? process.env[`${prefix}_CLIENT_ID`] : undefined;

  if (!clientId) {
    return NextResponse.json(
      { error: `${connectorId} OAuth is not configured. Set ${prefix}_CLIENT_ID in environment variables.` },
      { status: 503 }
    );
  }

  // Generate a CSRF state token and store it in a cookie
  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri =
    process.env[`${prefix}_REDIRECT_URI`] ||
    `${process.env.NEXTAUTH_URL}/api/connectors/${connectorId}/oauth/callback`;

  const authUrl = new URL(connector.authConfig.authorizationUrl!);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", (connector.authConfig.scopes || []).join(" "));
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString());

  // Store state + userId in a short-lived encrypted cookie so callback can verify
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
