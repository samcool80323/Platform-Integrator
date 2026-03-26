import { prisma } from "../db";
import { decrypt, encrypt } from "../encryption";
import { GHLClient } from "./client";

const GHL_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
const GHL_LOCATION_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/locationToken";

/**
 * Get a valid agency access token, refreshing if expired.
 */
export async function getAgencyToken(userId: string): Promise<string> {
  const cred = await prisma.ghlAgencyCredential.findUnique({
    where: { userId },
  });

  if (!cred?.accessToken || !cred?.refreshToken) {
    throw new Error("GHL credentials not configured. Please connect in Settings.");
  }

  // Check if token needs refresh (within 5 minutes of expiry)
  if (cred.tokenExpiresAt && cred.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    return refreshAgencyToken(userId);
  }

  return decrypt(cred.accessToken);
}

/**
 * Refresh the agency token using the stored refresh token.
 */
async function refreshAgencyToken(userId: string): Promise<string> {
  const cred = await prisma.ghlAgencyCredential.findUnique({
    where: { userId },
  });

  if (!cred?.refreshToken) {
    throw new Error("No refresh token available. Please reconnect GHL.");
  }

  const res = await fetch(GHL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cred.clientId,
      client_secret: decrypt(cred.clientSecret),
      grant_type: "refresh_token",
      refresh_token: decrypt(cred.refreshToken),
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errBody = await res.json();
      detail = ` — ${errBody.message || errBody.error || JSON.stringify(errBody)}`;
    } catch {
      // no JSON body
    }
    throw new Error(`Failed to refresh GHL token: ${res.status}${detail}`);
  }

  const data = await res.json();

  await prisma.ghlAgencyCredential.update({
    where: { userId },
    data: {
      accessToken: encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token),
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}

/**
 * Get a location-scoped access token for a specific sub-account.
 */
export async function getLocationToken(
  agencyToken: string,
  companyId: string,
  locationId: string
): Promise<string> {
  const res = await fetch(GHL_LOCATION_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${agencyToken}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
    body: JSON.stringify({ companyId, locationId }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errBody = await res.json();
      detail = ` — ${errBody.message || errBody.error || JSON.stringify(errBody)}`;
    } catch {
      // no JSON body
    }
    throw new Error(`Failed to get location token: ${res.status}${detail}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Create a GHL client for a specific sub-account location.
 */
export async function createLocationClient(
  userId: string,
  locationId: string
): Promise<GHLClient> {
  const agencyToken = await getAgencyToken(userId);

  const cred = await prisma.ghlAgencyCredential.findUnique({
    where: { userId },
  });

  if (!cred?.companyId) {
    throw new Error("GHL company ID not found. Please reconnect.");
  }

  const locationToken = await getLocationToken(agencyToken, cred.companyId, locationId);
  return new GHLClient({ token: locationToken });
}
