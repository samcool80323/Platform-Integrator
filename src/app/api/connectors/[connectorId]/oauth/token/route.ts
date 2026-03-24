import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";

// Called by the wizard after OAuth redirect to retrieve the stored token
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ connectorId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { connectorId } = await params;
  const tokenCookie = req.cookies.get(`oauth_token_${connectorId}`)?.value;

  if (!tokenCookie) {
    return NextResponse.json({ error: "No OAuth token found. Please reconnect." }, { status: 404 });
  }

  try {
    const tokenData = JSON.parse(decrypt(tokenCookie));

    // Return token to client and clear the cookie
    const response = NextResponse.json({ credentials: { accessToken: tokenData.accessToken } });
    response.cookies.delete(`oauth_token_${connectorId}`);
    return response;
  } catch {
    return NextResponse.json({ error: "Failed to read token" }, { status: 500 });
  }
}
