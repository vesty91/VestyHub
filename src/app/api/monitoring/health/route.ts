import { NextResponse } from "next/server";

import { getAlertmanagerStatus } from "@/connectors/monitoring/alertmanager";
import { getLokiStatus } from "@/connectors/monitoring/loki";
import { getPrometheusStatus } from "@/connectors/monitoring/prometheus";
import { getCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const sources = await Promise.all([
    getPrometheusStatus(),
    getLokiStatus(),
    getAlertmanagerStatus(),
  ]);

  return NextResponse.json(
    { version: 1, data: { checkedAt: new Date().toISOString(), sources } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
