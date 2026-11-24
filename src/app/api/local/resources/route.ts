import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { getLocalResources } from "@/lib/local-system/metrics";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401, headers: noStore },
    );
  }

  const env = getEnv();
  // Never report NAS/container host metrics as if they belonged to the Windows PC.
  if (
    process.platform !== "win32" ||
    env.NODE_ENV !== "development" ||
    env.SYNOLOGY_ENABLED
  ) {
    return NextResponse.json(
      { error: "Métriques Windows locales indisponibles." },
      { status: 404, headers: noStore },
    );
  }

  try {
    return NextResponse.json(
      { version: 1, data: await getLocalResources() },
      { headers: noStore },
    );
  } catch {
    return NextResponse.json(
      { error: "Collecte locale indisponible." },
      { status: 503, headers: noStore },
    );
  }
}
