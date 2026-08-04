import { NextResponse } from "next/server";

import { monitoringRangeSchema } from "@/connectors/monitoring/range";
import { getCurrentSession } from "@/lib/auth/session";
import { getMonitoringOverview } from "@/lib/monitoring/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const rawRange = new URL(request.url).searchParams.get("range") ?? "1h";
  const parsedRange = monitoringRangeSchema.safeParse(rawRange);
  if (!parsedRange.success) {
    return NextResponse.json(
      { error: "Période invalide." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const overview = await getMonitoringOverview(parsedRange.data);
  return NextResponse.json(
    { version: 1, data: overview },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
