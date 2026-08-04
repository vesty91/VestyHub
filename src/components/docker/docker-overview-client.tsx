"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DockerContainer, DockerOverview } from "@/connectors/docker/types";

function formatBytes(bytes: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: 1,
  }).format(bytes / 1024 ** 2);
}

function formatUptime(seconds?: number): string {
  if (seconds === undefined) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days ? `${days} j` : "", hours ? `${hours} h` : "", `${minutes} min`]
    .filter(Boolean)
    .join(" ");
}

function stateLabel(container: DockerContainer): string {
  return `${container.state}${container.health !== "none" ? ` · ${container.health}` : ""}`;
}

export function DockerOverviewClient({ initial }: { initial: DockerOverview }) {
  const [overview, setOverview] = useState(initial);
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [health, setHealth] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/docker/overview", { cache: "no-store" });
      const data = (await response.json()) as DockerOverview;
      setOverview(data);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const containers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return overview.containers.filter((container) => {
      const matchesQuery =
        !needle ||
        [container.name, container.image, container.composeProject, container.composeService]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(needle));
      const matchesState =
        state === "all" ||
        (state === "running" && container.state === "running") ||
        (state === "stopped" && container.state !== "running");
      const matchesHealth = health === "all" || container.health === health;
      return matchesQuery && matchesState && matchesHealth;
    });
  }, [health, overview.containers, query, state]);

  if (!overview.available || !overview.engine) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="font-medium">Docker du NAS indisponible</p>
          <p className="mt-2 text-sm text-zinc-500">{overview.error}</p>
          <Button className="mt-5" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw className={refreshing ? "animate-spin" : ""} /> Actualiser
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Total", overview.counters.total],
          ["En cours", overview.counters.running],
          ["Arrêtés", overview.counters.stopped],
          ["Non sains", overview.counters.unhealthy],
          ["Images", overview.engine.images],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent>
              <p className="text-xs tracking-[0.14em] text-zinc-600 uppercase">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-medium">Source : NAS Synology</p>
              <p className="text-sm text-zinc-500">
                Hôte Docker : {overview.engine.name} · Docker {overview.engine.version}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className="h-9 rounded-md border border-white/10 bg-black/20 px-3 text-sm"
                aria-label="Rechercher un conteneur"
                placeholder="Rechercher…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select
                className="h-9 rounded-md border border-white/10 bg-black/20 px-3 text-sm"
                aria-label="Filtrer par état"
                value={state}
                onChange={(event) => setState(event.target.value)}
              >
                <option value="all">Tous les états</option>
                <option value="running">Running</option>
                <option value="stopped">Stopped</option>
              </select>
              <select
                className="h-9 rounded-md border border-white/10 bg-black/20 px-3 text-sm"
                aria-label="Filtrer par santé"
                value={health}
                onChange={(event) => setHealth(event.target.value)}
              >
                <option value="all">Toutes les santés</option>
                <option value="healthy">Healthy</option>
                <option value="unhealthy">Unhealthy</option>
                <option value="starting">Starting</option>
                <option value="none">Sans healthcheck</option>
              </select>
              <Button onClick={() => void refresh()} disabled={refreshing}>
                <RefreshCw className={refreshing ? "animate-spin" : ""} /> Actualiser
              </Button>
            </div>
          </div>

          <p className="text-xs text-zinc-500" aria-live="polite">
            Dernière actualisation : {new Date(overview.fetchedAt).toLocaleTimeString("fr-FR")}
            {overview.partial ? " · données partielles" : ""}
          </p>

          <div className="grid gap-3 xl:grid-cols-2">
            {containers.map((container) => (
              <article key={container.id} className="rounded-xl border border-white/[0.07] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-medium">{container.name}</h2>
                    <p className="truncate text-xs text-zinc-500">{container.image}</p>
                  </div>
                  <Badge>{stateLabel(container)}</Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-zinc-500">Uptime</dt><dd>{formatUptime(container.uptimeSeconds)}</dd></div>
                  <div><dt className="text-zinc-500">Redémarrages</dt><dd>{container.restartCount}</dd></div>
                  <div><dt className="text-zinc-500">CPU</dt><dd>{container.metrics ? `${container.metrics.cpuPercent.toFixed(1)} %` : "—"}</dd></div>
                  <div><dt className="text-zinc-500">RAM</dt><dd>{container.metrics ? `${formatBytes(container.metrics.memoryUsageBytes)} / ${formatBytes(container.metrics.memoryLimitBytes)}` : "—"}</dd></div>
                </dl>
                <p className="mt-3 text-xs text-zinc-500">
                  {container.composeProject && container.composeService
                    ? `${container.composeProject} / ${container.composeService}`
                    : "Hors projet Compose"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Ports : {container.ports.filter((port) => port.publicPort).map((port) => `${port.publicPort}:${port.privatePort}/${port.protocol}`).join(", ") || "—"}
                </p>
                {container.warning ? <p className="mt-2 text-xs text-amber-300">{container.warning}</p> : null}
                {container.serviceUrl ? (
                  <Button asChild variant="ghost" className="mt-3">
                    <a href={container.serviceUrl} target="_blank" rel="noreferrer">
                      <ExternalLink /> Ouvrir
                    </a>
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
          {containers.length === 0 ? <p className="py-10 text-center text-sm text-zinc-500">Aucun conteneur ne correspond aux filtres.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
