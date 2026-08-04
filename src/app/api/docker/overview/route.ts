import { NextResponse } from "next/server";

import { getDockerOverview } from "@/connectors/docker/client";
import { getCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const overview = await getDockerOverview();
  return NextResponse.json(overview, {
    status: overview.available ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
