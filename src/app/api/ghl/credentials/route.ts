import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { z } from "zod";

const credentialSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { clientId, clientSecret } = credentialSchema.parse(body);

    // Upsert the credential
    await prisma.ghlAgencyCredential.upsert({
      where: { userId: session.user.id },
      update: {
        clientId,
        clientSecret: encrypt(clientSecret),
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
      },
      create: {
        userId: session.user.id,
        clientId,
        clientSecret: encrypt(clientSecret),
      },
    });

    // Build the GHL OAuth authorization URL
    const redirectUri = process.env.GHL_APP_REDIRECT_URI || "http://localhost:3000/api/ghl/auth/callback";
    const authUrl = new URL("https://marketplace.gohighlevel.com/oauth/chooselocation");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", [
      "contacts.readonly",
      "contacts.write",
      "conversations.readonly",
      "conversations.write",
      "conversations/message.readonly",
      "conversations/message.write",
      "locations.readonly",
      "locations/customFields.readonly",
      "locations/customFields.write",
      "opportunities.readonly",
      "opportunities.write",
      "calendars.readonly",
      "calendars/events.readonly",
      "calendars/events.write",
    ].join(" "));

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
