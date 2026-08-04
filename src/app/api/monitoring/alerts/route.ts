import { NextResponse } from "next/server";

import { getActiveAlerts } from "@/connectors/monitoring/alertmanager";
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

  try {
    const alerts = await getActiveAlerts();
    return NextResponse.json(
      { version: 1, data: { generatedAt: new Date().toISOString(), alerts } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Alertes temporairement indisponibles." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
