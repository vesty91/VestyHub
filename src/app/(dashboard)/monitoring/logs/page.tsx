import Link from "next/link";
import { Activity, Search, TerminalSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel, PanelHeader, StatusDot } from "@/components/vestyhub/primitives";
import {
  getLokiLogs,
  getLokiStatus,
  lokiLogSourceSchema,
} from "@/connectors/monitoring/loki";
import type { MonitoringLogEntry, MonitoringRange } from "@/connectors/monitoring/types";
import { requireUser } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

const allowedRanges = ["1h", "6h", "24h"] as const;

function normalizeRange(value?: string): (typeof allowedRanges)[number] {
  return allowedRanges.includes(value as (typeof allowedRanges)[number])
    ? (value as (typeof allowedRanges)[number])
    : "1h";
}

function levelTone(level: MonitoringLogEntry["level"]) {
  switch (level) {
    case "error":
      return "danger" as const;
    case "warn":
      return "warning" as const;
    case "info":
      return "info" as const;
    case "debug":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

export default async function MonitoringLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; source?: string; query?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const range = normalizeRange(params.range);
  const source = lokiLogSourceSchema.catch("all").parse(params.source);
  const query = params.query?.trim().slice(0, 200) ?? "";
  const status = await getLokiStatus();
  let logs: MonitoringLogEntry[] = [];
  let loadError = false;

  if (status.available) {
    try {
      logs = await getLokiLogs({
        range: range as MonitoringRange,
        source,
        searchText: query,
        limit: 200,
      });
    } catch {
      loadError = true;
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <PageHeader
        title="Journaux"
        description="Lecture bornée des journaux Docker ingérés par Alloy et Loki. Les messages sont affichés comme texte brut."
        eyebrow={
          <Badge variant="outline" className="text-primary">
            Loki · maximum 200 lignes
          </Badge>
        }
        actions={
          <Link href="/monitoring" className="text-primary text-sm font-medium">
            Retour au monitoring
          </Link>
        }
      />

      <Panel>
        <PanelHeader
          title="Filtres"
          subtitle="Période maximale : 24 heures"
          icon={<Search className="size-4" />}
          action={
            <StatusDot
              label={status.available ? "Loki disponible" : "Loki indisponible"}
              tone={status.available ? "success" : "danger"}
              pulse={status.available}
            />
          }
        />
        <form method="get" className="grid gap-3 md:grid-cols-[140px_160px_1fr_auto]">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Période</span>
            <select
              name="range"
              defaultValue={range}
              className="bg-background border-border h-10 w-full rounded-xl border px-3"
            >
              {allowedRanges.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Flux</span>
            <select
              name="source"
              defaultValue={source}
              className="bg-background border-border h-10 w-full rounded-xl border px-3"
            >
              <option value="all">Tous</option>
              <option value="stdout">stdout</option>
              <option value="stderr">stderr</option>
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Recherche textuelle</span>
            <input
              name="query"
              defaultValue={query}
              maxLength={200}
              placeholder="Erreur, service, message…"
              className="bg-background border-border h-10 w-full rounded-xl border px-3"
            />
          </label>
          <button
            type="submit"
            className="bg-primary text-primary-foreground mt-auto h-10 rounded-xl px-4 text-sm font-medium"
          >
            Rechercher
          </button>
        </form>
      </Panel>

      <Panel>
        <PanelHeader
          title="Résultats"
          subtitle={`${logs.length} ligne${logs.length > 1 ? "s" : ""}`}
          icon={<TerminalSquare className="size-4" />}
        />
        {!status.available || loadError ? (
          <div className="border-destructive/25 bg-destructive/8 text-muted-foreground rounded-xl border px-4 py-8 text-center text-sm">
            Les journaux sont temporairement indisponibles.
          </div>
        ) : logs.length === 0 ? (
          <div className="border-border bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm">
            Aucun journal ne correspond aux filtres sélectionnés.
          </div>
        ) : (
          <ol className="divide-border overflow-hidden rounded-xl border">
            {logs.map((entry) => (
              <li key={entry.id} className="bg-card hover:bg-muted/20 grid gap-2 px-4 py-3 md:grid-cols-[190px_100px_1fr]">
                <time dateTime={entry.timestamp} className="text-muted-foreground font-mono text-xs">
                  {new Intl.DateTimeFormat("fr-FR", {
                    dateStyle: "short",
                    timeStyle: "medium",
                  }).format(new Date(entry.timestamp))}
                </time>
                <StatusDot label={entry.level} tone={levelTone(entry.level)} />
                <div className="min-w-0">
                  <p className="text-muted-foreground mb-1 text-xs">{entry.source}</p>
                  <pre className="text-foreground overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-5">
                    {entry.message}
                  </pre>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <Activity className="size-3.5" />
        Requête LogQL construite uniquement côté serveur à partir de filtres autorisés.
      </p>
    </div>
  );
}
