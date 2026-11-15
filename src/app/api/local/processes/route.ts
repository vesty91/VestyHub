import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { getLocalProcesses } from "@/lib/local-system/processes";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401, headers },
    );
  }

  const env = getEnv();
  // Never expose host process names from the NAS, production or container environment.
  if (
    process.platform !== "win32" ||
    env.NODE_ENV !== "development" ||
    env.SYNOLOGY_ENABLED
  ) {
    return NextResponse.json(
      { error: "Supervision locale Windows indisponible." },
      { status: 404, headers },
    );
  }

  try {
    const data = await getLocalProcesses();
    return NextResponse.json({ version: 1, data }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Impossible de collecter les processus Windows." },
      { status: 503, headers },
    );
  }
}
