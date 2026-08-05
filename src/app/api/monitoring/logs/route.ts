import { NextResponse } from "next/server";
import { z } from "zod";

import { getLokiLogs, lokiLogSourceSchema } from "@/connectors/monitoring/loki";
import { getCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const logsQuerySchema = z.object({
  range: z.enum(["1h", "6h", "24h"]).default("1h"),
  source: lokiLogSourceSchema.default("all"),
  query: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const parsed = logsQuerySchema.safeParse({
    range: searchParams.get("range") ?? undefined,
    source: searchParams.get("source") ?? undefined,
    query: searchParams.get("query") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres de journaux invalides." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const logs = await getLokiLogs({
      range: parsed.data.range,
      source: parsed.data.source,
      searchText: parsed.data.query,
      limit: parsed.data.limit,
    });
    return NextResponse.json(
      {
        version: 1,
        data: {
          generatedAt: new Date().toISOString(),
          range: parsed.data.range,
          source: parsed.data.source,
          logs,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Journaux temporairement indisponibles." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
