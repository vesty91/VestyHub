"use client";

import { Activity, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  hasConfiguredMonitoringSource,
  monitoringAvailability,
} from "@/connectors/monitoring/availability";
import type { MonitoringOverview, MonitoringSource } from "@/connectors/monitoring/types";
import type { MonitoringWidgetConfiguration } from "@/lib/dashboard/widget-catalog";

const REFRESH_INTERVAL_MS = 15_000;

const SOURCE_LABELS: Record<MonitoringSource, string> = {
  prometheus: "Prometheus",
  loki: "Loki",
  alertmanager: "Alertmanager",
};

export function MonitoringWidget({
  configuration,
}: {
  configuration: MonitoringWidgetConfiguration;
}) {
  const [overview, setOverview] = useState<MonitoringOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const allSourcesUnconfigured = useRef(false);

  useEffect(() => {
    allSourcesUnconfigured.current = false;
    let active = true;
    let controller: AbortController | null = null;

    async function loadOverview() {
      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetch(
          `/api/monitoring/overview?range=${encodeURIComponent(configuration.range)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const payload = (await response.json().catch(() => null)) as {
          data?: MonitoringOverview;
          error?: string;
        } | null;

        if (!response.ok || !payload?.data) {
          throw new Error(
            payload?.error ?? `Monitoring indisponible (${response.status}).`,
          );
        }

        if (active) {
          allSourcesUnconfigured.current = !hasConfiguredMonitoringSource(
            payload.data.sources,
          );
          setOverview(payload.data);
          setError(null);
        }
      } catch (caughtError) {
        if (
          !active ||
          (caughtError instanceof DOMException && caughtError.name === "AbortError")
        ) {
          return;
        }
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Impossible de charger le monitoring.",
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadOverview();
    const timer = window.setInterval(() => {
      // Avoid polling an intentionally disabled stack, or while the browser
      // tab is hidden. The server configuration is loaded on page refresh.
      if (document.visibilityState === "visible" && !allSourcesUnconfigured.current) {
        void loadOverview();
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [configuration.range]);

  const summary = overview?.summary;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
      <div className="mb-4 flex items-start justify-between gap-3 pr-10">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-cyan-300" aria-hidden="true" />
            <p className="text-sm font-medium">Monitoring</p>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Prometheus · période {configuration.range}
          </p>
        </div>
        <RefreshCw
          className={`size-3.5 text-zinc-500 ${isLoading ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
      </div>

      {overview && !hasConfiguredMonitoringSource(overview.sources) ? (
        <div
          className="border-border/60 bg-background/30 grid flex-1 place-items-center rounded-xl border p-4 text-center"
          role="status"
        >
          <div>
            <p className="text-sm font-medium">Monitoring non configuré</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Aucune source Prometheus, Loki ou Alertmanager n’est activée. Ce n’est pas
              une panne. Configure une source pour activer les métriques.
            </p>
          </div>
        </div>
      ) : error && !overview ? (
        <div className="border-warning/20 bg-warning/[0.06] grid flex-1 place-items-center rounded-xl border p-4 text-center">
          <div>
            <p className="text-warning text-sm font-medium">Monitoring indisponible</p>
            <p className="text-muted-foreground mt-1 text-xs">{error}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="CPU" value={formatPercent(summary?.cpuPercent)} />
            <Metric label="RAM" value={formatPercent(summary?.memoryPercent)} />
            <Metric label="Stockage" value={formatPercent(summary?.filesystemPercent)} />
            <Metric label="Conteneurs" value={formatCount(summary?.runningContainers)} />
          </div>

          {configuration.showAlerts ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="border-border/60 bg-background/35 rounded-xl border px-3 py-2.5">
                <p className="text-[11px] text-zinc-500">Alertes actives</p>
                <p className="mt-1 text-lg font-semibold">
                  {overview?.alerts?.firing ?? "—"}
                </p>
              </div>
              <div className="border-border/60 bg-background/35 rounded-xl border px-3 py-2.5">
                <p className="text-[11px] text-zinc-500">En attente</p>
                <p className="mt-1 text-lg font-semibold">
                  {overview?.alerts?.pending ?? "—"}
                </p>
              </div>
            </div>
          ) : null}

          {configuration.showSources ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {(overview?.sources ?? []).map((source) => (
                <span
                  key={source.source}
                  className="border-border/60 bg-background/35 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] text-zinc-400"
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      monitoringAvailability(source) === "available"
                        ? "bg-emerald-400"
                        : monitoringAvailability(source) === "unreachable"
                          ? "bg-red-400"
                          : "bg-zinc-500"
                    }`}
                    aria-hidden="true"
                  />
                  {SOURCE_LABELS[source.source]}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-auto pt-3 text-[10px] text-zinc-600" aria-live="polite">
            {error
              ? `Dernière mise à jour conservée · ${error}`
              : overview
                ? `Actualisé à ${new Date(overview.generatedAt).toLocaleTimeString("fr-FR")}`
                : "Chargement des métriques…"}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/60 bg-background/35 rounded-xl border px-3 py-2.5">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function formatPercent(value: number | undefined): string {
  return Number.isFinite(value) ? `${Math.round(value!)} %` : "—";
}

function formatCount(value: number | undefined): string {
  return Number.isFinite(value) ? String(Math.round(value!)) : "—";
}
