import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/encryption";
import { getConnector } from "@/lib/connectors/registry";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ connectorId: string }> }
) {
  const { connectorId } = await params;
  const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const returnUrl = `${baseUrl}/migrations/new`;

  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      `${returnUrl}?oauth_error=${encodeURIComponent(errorParam)}&oauth_connector=${connectorId}`
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      `${returnUrl}?oauth_error=missing_params&oauth_connector=${connectorId}`
    );
  }

  // Validate state cookie (CSRF protection)
  const stateCookie = req.cookies.get(`oauth_state_${connectorId}`)?.value;
  if (!stateCookie) {
    return NextResponse.redirect(
      `${returnUrl}?oauth_error=session_expired&oauth_connector=${connectorId}`
    );
  }

  let cookieData: { state: string; userId: string; connectorId: string };
  try {
    cookieData = JSON.parse(decrypt(stateCookie));
  } catch {
    return NextResponse.redirect(
      `${returnUrl}?oauth_error=invalid_state&oauth_connector=${connectorId}`
    );
  }

  if (cookieData.state !== stateParam || cookieData.connectorId !== connectorId) {
    return NextResponse.redirect(
      `${returnUrl}?oauth_error=state_mismatch&oauth_connector=${connectorId}`
    );
  }

  const connector = getConnector(connectorId);
  if (!connector || connector.authConfig.type !== "oauth2") {
    return NextResponse.redirect(
      `${returnUrl}?oauth_error=connector_not_found&oauth_connector=${connectorId}`
    );
  }

  // Load the user's OAuth app credentials from DB
  const oauthApp = await prisma.connectorOAuthApp.findUnique({
    where: { userId_connectorId: { userId: cookieData.userId, connectorId } },
  });

  if (!oauthApp) {
    return NextResponse.redirect(
      `${baseUrl}/settings?oauth_setup_needed=${connectorId}`
    );
  }

  const clientId = decrypt(oauthApp.clientId);
  const clientSecret = decrypt(oauthApp.clientSecret);
  const redirectUri = oauthApp.redirectUri || `${baseUrl}/api/connectors/${connectorId}/oauth/callback`;

  try {
    const tokenRes = await fetch(connector.authConfig.tokenUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error(`[oauth/callback] ${connectorId} token exchange failed:`, errText);
      return NextResponse.redirect(
        `${returnUrl}?oauth_error=token_exchange_failed&oauth_connector=${connectorId}`
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken: string = tokenData.access_token;
    const refreshToken: string | undefined = tokenData.refresh_token;
    const expiresIn: number | undefined = tokenData.expires_in;

    // Store tokens in an encrypted short-lived cookie for the wizard to pick up
    const tokenPayload = encrypt(
      JSON.stringify({
        accessToken,
        refreshToken,
        expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
      })
    );

    const response = NextResponse.redirect(
      `${returnUrl}?oauth_done=1&oauth_connector=${connectorId}`
    );

    response.cookies.set(`oauth_token_${connectorId}`, tokenPayload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300, // 5 minutes to complete wizard step
      path: "/",
    });

    response.cookies.delete(`oauth_state_${connectorId}`);
    return response;
  } catch (err) {
    console.error(`[oauth/callback] ${connectorId} error:`, err);
    return NextResponse.redirect(
      `${returnUrl}?oauth_error=server_error&oauth_connector=${connectorId}`
    );
  }
}
