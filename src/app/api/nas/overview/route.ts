import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { getNasOverview } from "@/lib/nas/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const overview = await getNasOverview();
  return NextResponse.json(
    { version: 1, data: overview },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
