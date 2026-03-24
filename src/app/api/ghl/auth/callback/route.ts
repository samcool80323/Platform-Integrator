import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=no_code", req.url));
  }

  const credential = await prisma.ghlAgencyCredential.findUnique({
    where: { userId: session.user.id },
  });

  if (!credential) {
    return NextResponse.redirect(new URL("/settings?error=no_credentials", req.url));
  }

  try {
    const redirectUri = process.env.GHL_APP_REDIRECT_URI || "http://localhost:3000/api/ghl/auth/callback";

    // Exchange code for tokens
    const tokenRes = await fetch("https://services.leadconnectorhq.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credential.clientId,
        client_secret: decrypt(credential.clientSecret),
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      console.error("GHL token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(new URL("/settings?error=token_exchange_failed", req.url));
    }

    const tokenData = await tokenRes.json();

    // Update the credential with tokens
    await prisma.ghlAgencyCredential.update({
      where: { userId: session.user.id },
      data: {
        accessToken: encrypt(tokenData.access_token),
        refreshToken: encrypt(tokenData.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        companyId: tokenData.companyId || tokenData.locationId,
        companyName: tokenData.companyName || tokenData.locationName || "Connected",
      },
    });

    return NextResponse.redirect(new URL("/settings?success=connected", req.url));
  } catch (error) {
    console.error("GHL auth callback error:", error);
    return NextResponse.redirect(new URL("/settings?error=auth_failed", req.url));
  }
}
