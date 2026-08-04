import { NextResponse } from "next/server";

import { checkDatabaseReadiness } from "@/lib/health/database";
import { logger } from "@/lib/logging/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const ready = await checkDatabaseReadiness();

  if (!ready) {
    logger.warn("Readiness check failed.", { dependency: "postgres" });
  }

  return NextResponse.json(
    { status: ready ? "ready" : "not_ready" },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
