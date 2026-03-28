import { prisma } from "../db";
import { encryptJson, decryptJson } from "../encryption";
import { getConnector } from "./registry";

/**
 * Ensure OAuth2 credentials are fresh. If the access token has expired
 * (or will expire within 5 minutes), use the refresh token to get a new one.
 *
 * Returns the (possibly refreshed) credentials.
 * If a refresh happens and credentialId is provided, persists the new tokens to DB.
 */
export async function ensureFreshOAuthCredentials(
  connectorId: string,
  creds: Record<string, string>,
  credentialId?: string
): Promise<Record<string, string>> {
  // Only relevant for OAuth2 connectors with a refresh token
  const connector = getConnector(connectorId);
  if (!connector || connector.authConfig.type !== "oauth2") return creds;
  if (!creds.refreshToken) return creds;

  // Check if token is expired or about to expire (5 min buffer)
  const expiresAt = creds.expiresAt ? Number(creds.expiresAt) : 0;
  const fiveMinFromNow = Date.now() + 5 * 60 * 1000;

  if (expiresAt > fiveMinFromNow) {
    // Token is still valid
    return creds;
  }

  // Token expired or no expiry info — try refreshing
  return refreshOAuthToken(connectorId, creds, credentialId);
}

async function refreshOAuthToken(
  connectorId: string,
  creds: Record<string, string>,
  credentialId?: string
): Promise<Record<string, string>> {
  const connector = getConnector(connectorId);
  if (!connector || !connector.authConfig.tokenUrl) {
    throw new Error(`Cannot refresh token: no tokenUrl for ${connectorId}`);
  }

  // Load OAuth app credentials (client_id/secret) for this connector
  // We need to find the user's OAuth app — look it up from the credential record
  let clientId: string | undefined;
  let clientSecret: string | undefined;
  let redirectUri: string | undefined;

  if (credentialId) {
    const credential = await prisma.connectorCredential.findFirst({
      where: { id: credentialId },
      select: { userId: true },
    });

    if (credential?.userId) {
      const { decrypt } = await import("../encryption");
      const oauthApp = await prisma.connectorOAuthApp.findUnique({
        where: {
          userId_connectorId: {
            userId: credential.userId,
            connectorId,
          },
        },
      });

      if (oauthApp) {
        clientId = decrypt(oauthApp.clientId);
        clientSecret = decrypt(oauthApp.clientSecret);
        const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "http://localhost:3000";
        redirectUri = oauthApp.redirectUri || `${baseUrl}/api/connectors/${connectorId}/oauth/callback`;
      }
    }
  }

  if (!clientId || !clientSecret) {
    throw new Error(`Cannot refresh token: OAuth app not found for ${connectorId}`);
  }

  const tokenRes = await fetch(connector.authConfig.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: creds.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => "");
    throw new Error(
      `Token refresh failed for ${connectorId} (${tokenRes.status}): ${errText.slice(0, 200)}`
    );
  }

  const tokenData = await tokenRes.json();
  const newCreds: Record<string, string> = {
    ...creds,
    accessToken: tokenData.access_token,
  };

  // Some providers rotate refresh tokens
  if (tokenData.refresh_token) {
    newCreds.refreshToken = tokenData.refresh_token;
  }

  if (tokenData.expires_in) {
    newCreds.expiresAt = String(Date.now() + tokenData.expires_in * 1000);
  }

  // Persist refreshed tokens to DB if we have a credential record
  if (credentialId) {
    await prisma.connectorCredential.update({
      where: { id: credentialId },
      data: {
        credentials: encryptJson(newCreds),
        lastValidated: new Date(),
      },
    });
  }

  return newCreds;
}
