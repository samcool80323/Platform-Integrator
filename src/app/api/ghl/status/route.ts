import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credential = await prisma.ghlAgencyCredential.findUnique({
    where: { userId: session.user.id },
  });

  if (!credential || !credential.accessToken) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    companyName: credential.companyName,
    tokenExpiresAt: credential.tokenExpiresAt?.toISOString(),
  });
}
