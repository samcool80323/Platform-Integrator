import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAgencyToken } from "@/lib/ghl/auth";
import { GHLClient } from "@/lib/ghl/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getAgencyToken(session.user.id);
    const client = new GHLClient({ token });

    const result = await client.get<{
      locations: { id: string; name: string; address?: string; city?: string }[];
    }>("/locations/search", { companyId: "" }); // companyId from stored creds

    return NextResponse.json({
      subAccounts: (result.locations || []).map((loc) => ({
        id: loc.id,
        name: loc.name,
        address: loc.address,
        city: loc.city,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sub-accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
