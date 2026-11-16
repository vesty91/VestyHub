import { and, asc, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { favorites } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";
import {
  classifyFavoriteHealthStatus,
  type FavoriteHealthResult,
} from "@/lib/favorites/health";
import { probeFavoriteHead, type HealthProbePolicy } from "@/lib/favorites/probe";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;
const HEALTH_CONCURRENCY = 6;

type HealthTarget = { id: string; url: string };

async function probeTarget(
  target: HealthTarget,
  policy: HealthProbePolicy,
): Promise<FavoriteHealthResult> {
  const startedAt = performance.now();
  const checkedAt = new Date().toISOString();

  try {
    const statusCode = await probeFavoriteHead(target.url, policy);

    return {
      id: target.id,
      status: classifyFavoriteHealthStatus(statusCode),
      statusCode,
      latencyMs: Math.round(performance.now() - startedAt),
      checkedAt,
    };
  } catch {
    return {
      id: target.id,
      status: "offline",
      statusCode: null,
      latencyMs: null,
      checkedAt,
    };
  }
}

async function probeTargets(
  targets: HealthTarget[],
  policy: HealthProbePolicy,
): Promise<FavoriteHealthResult[]> {
  const results: FavoriteHealthResult[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < targets.length) {
      const target = targets[cursor];
      cursor += 1;
      if (target) {
        results.push(await probeTarget(target, policy));
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(HEALTH_CONCURRENCY, targets.length) }, () => worker()),
  );

  return results;
}

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const storedTargets = await db
    .select({ id: favorites.id, url: favorites.healthCheckUrl })
    .from(favorites)
    .where(
      and(
        eq(favorites.userId, session.user.id),
        eq(favorites.healthCheckEnabled, true),
        isNotNull(favorites.healthCheckUrl),
      ),
    )
    .orderBy(asc(favorites.sortOrder))
    .limit(96);

  const env = getEnv();
  const policy: HealthProbePolicy = {
    allowedHosts: env.HEALTHCHECK_ALLOWED_HOSTS,
    allowedCidrs: env.HEALTHCHECK_ALLOWED_CIDRS,
  };

  const targets = storedTargets.flatMap((target) =>
    target.url ? [{ id: target.id, url: target.url }] : [],
  );
  const items = await probeTargets(targets, policy);

  return NextResponse.json({ version: 1, items }, { headers: NO_STORE_HEADERS });
}
