import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAgencyToken } from "@/lib/ghl/auth";
import { GHLClient } from "@/lib/ghl/client";
import { prisma } from "@/lib/db";

interface LocationResult {
  locations: { id: string; name: string; address?: string; city?: string }[];
  meta?: { total?: number; currentPage?: number; nextPage?: number };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getAgencyToken(session.user.id);
    const client = new GHLClient({ token });

    // Get the stored companyId
    const cred = await prisma.ghlAgencyCredential.findUnique({
      where: { userId: session.user.id },
    });

    if (!cred?.companyId) {
      return NextResponse.json(
        { error: "GHL company ID not found. Please reconnect in Settings." },
        { status: 400 }
      );
    }

    // Paginate through ALL locations (GHL defaults to 10 per page)
    const allLocations: { id: string; name: string; address?: string; city?: string }[] = [];
    let page = 1;
    const limit = 100; // max per page

    while (true) {
      const result = await client.get<LocationResult>("/locations/search", {
        companyId: cred.companyId,
        limit: String(limit),
        skip: String((page - 1) * limit),
      });

      const locations = result.locations || [];
      for (const loc of locations) {
        allLocations.push({
          id: loc.id,
          name: loc.name,
          address: loc.address,
          city: loc.city,
        });
      }

      // Stop if we got fewer than the limit (last page)
      if (locations.length < limit) break;
      page++;

      // Safety cap at 1000 locations
      if (allLocations.length >= 1000) break;
    }

    return NextResponse.json({ subAccounts: allLocations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sub-accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
