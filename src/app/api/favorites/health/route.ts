import { and, asc, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { favorites } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";
import {
  classifyFavoriteHealthStatus,
  type FavoriteHealthResult,
} from "@/lib/favorites/health";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;
const HEALTH_TIMEOUT_MS = 3000;
const HEALTH_CONCURRENCY = 6;

type HealthTarget = { id: string; url: string };

async function probeTarget(target: HealthTarget): Promise<FavoriteHealthResult> {
  const startedAt = performance.now();
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(target.url, {
      method: "HEAD",
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      headers: { "User-Agent": "VestyHub-Health/1.0" },
    });

    return {
      id: target.id,
      status: classifyFavoriteHealthStatus(response.status),
      statusCode: response.status,
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

async function probeTargets(targets: HealthTarget[]): Promise<FavoriteHealthResult[]> {
  const results: FavoriteHealthResult[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < targets.length) {
      const target = targets[cursor];
      cursor += 1;
      if (target) {
        results.push(await probeTarget(target));
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

  const targets = storedTargets.flatMap((target) =>
    target.url ? [{ id: target.id, url: target.url }] : [],
  );
  const items = await probeTargets(targets);

  return NextResponse.json({ version: 1, items }, { headers: NO_STORE_HEADERS });
}
