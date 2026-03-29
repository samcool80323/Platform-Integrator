import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createLocationClient } from "@/lib/ghl/auth";
import { getCustomFields } from "@/lib/ghl/custom-fields";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ error: "locationId required" }, { status: 400 });
  }

  try {
    const client = await createLocationClient(session.user.id, locationId);
    const fields = await getCustomFields(client, locationId);

    // Folders are entries with no dataType (or empty dataType)
    const folders = fields
      .filter((f) => !f.dataType || f.dataType === "")
      .map((f) => ({ id: f.id, name: f.name }));

    return NextResponse.json({ folders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch folders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
