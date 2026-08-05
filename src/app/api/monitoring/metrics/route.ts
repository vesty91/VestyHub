import { NextResponse } from "next/server";

import {
  isPrometheusMetricId,
  queryPrometheusMetric,
} from "@/connectors/monitoring/prometheus";
import { monitoringRangeSchema } from "@/connectors/monitoring/range";
import { getCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const metric = searchParams.get("metric");
  const range = monitoringRangeSchema.safeParse(searchParams.get("range") ?? "1h");
  if (!isPrometheusMetricId(metric) || !range.success) {
    return NextResponse.json(
      { error: "Paramètres de métrique invalides." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const series = await queryPrometheusMetric(metric, range.data);
    return NextResponse.json(
      { version: 1, data: { metric, range: range.data, series } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Métrique temporairement indisponible." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
