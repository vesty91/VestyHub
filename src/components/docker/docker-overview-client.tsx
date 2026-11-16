"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Boxes,
  CircleAlert,
  CircleCheck,
  Container,
  Cpu,
  ExternalLink,
  HardDrive,
  LockKeyhole,
  MemoryStick,
  Play,
  RefreshCw,
  Search,
  Server,
  Square,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DockerContainerAction } from "@/connectors/docker/control";
import type { DockerContainer, DockerOverview } from "@/connectors/docker/types";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<DockerContainerAction, string> = {
  start: "Démarrer",
  stop: "Arrêter",
  restart: "Redémarrer",
};

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

function isProtected(container: DockerContainer): boolean {
  return (
    container.composeProject === "vestyhub" &&
    ["app", "postgres", "docker-socket-proxy", "docker-control-proxy"].includes(
      container.composeService ?? "",
    )
  );
}

function statusStyle(container: DockerContainer) {
  if (container.health === "unhealthy") {
    return {
      label: "Non sain",
      dot: "bg-rose-400",
      badge: "border-rose-400/20 bg-rose-400/10 text-rose-200",
      glow: "from-rose-400/15",
    };
  }
  if (container.state === "running") {
    return {
      label: container.health === "healthy" ? "Sain" : "En ligne",
      dot: "bg-emerald-400",
      badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
      glow: "from-emerald-400/15",
    };
  }
  if (container.state === "restarting") {
    return {
      label: "Redémarrage",
      dot: "bg-amber-300",
      badge: "border-amber-300/20 bg-amber-300/10 text-amber-100",
      glow: "from-amber-300/15",
    };
  }
  return {
    label: "Arrêté",
    dot: "bg-zinc-500",
    badge: "border-white/10 bg-white/5 text-zinc-300",
    glow: "from-zinc-400/10",
  };
}

function Meter({ value, tone }: { value: number; tone: "cyan" | "violet" }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          tone === "cyan" ? "bg-cyan-400" : "bg-violet-400",
        )}
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </div>
  );
}

export function DockerOverviewClient({
  initial,
  canControl,
}: {
  initial: DockerOverview;
  canControl: boolean;
}) {
  const [overview, setOverview] = useState(initial);
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [health, setHealth] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    container: DockerContainer;
    action: DockerContainerAction;
  } | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const response = await fetch("/api/docker/overview", { cache: "no-store" });
      const data = (await response.json()) as DockerOverview | { error?: string };
      if (!response.ok || !("containers" in data)) {
        throw new Error(data.error ?? "Actualisation impossible.");
      }
      setOverview(data);
    } catch (error) {
      setRefreshError(
        error instanceof Error ? error.message : "Actualisation impossible.",
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (overview.configured === false) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [refresh, overview.configured]);

  const containers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return overview.containers.filter((container) => {
      const matchesQuery =
        !needle ||
        [
          container.name,
          container.image,
          container.composeProject,
          container.composeService,
        ]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(needle));
      const matchesState =
        state === "all" ||
        (state === "running" && container.state === "running") ||
        (state === "stopped" && container.state !== "running");
      return (
        matchesQuery && matchesState && (health === "all" || container.health === health)
      );
    });
  }, [health, overview.containers, query, state]);

  const runAction = useCallback(
    async (container: DockerContainer, action: DockerContainerAction) => {
      setPendingAction(`${container.id}:${action}`);
      setActionMessage(null);
      try {
        const response = await fetch("/api/docker/containers/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ containerId: container.id, action }),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Commande impossible.");
        setActionMessage({
          tone: "success",
          text: `${container.name} : commande « ${ACTION_LABELS[action].toLowerCase()} » exécutée.`,
        });
        await refresh();
      } catch (error) {
        setActionMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "Commande impossible.",
        });
      } finally {
        setPendingAction(null);
        setConfirmAction(null);
      }
    },
    [refresh],
  );

  if (!overview.available || !overview.engine) {
    const notConfigured = overview.configured === false;
    return (
      <Card
        className={
          notConfigured
            ? "border-white/10 bg-white/[0.02]"
            : "border-rose-400/15 bg-rose-400/[0.04]"
        }
      >
        <CardContent className="py-14 text-center" role="status">
          {notConfigured ? (
            <Server className="mx-auto size-9 text-zinc-400" aria-hidden="true" />
          ) : (
            <CircleAlert className="mx-auto size-9 text-rose-300" aria-hidden="true" />
          )}
          <p className="mt-4 font-medium">
            {notConfigured ? "Docker du NAS non configuré" : "Docker du NAS indisponible"}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {notConfigured
              ? "Aucun proxy Docker NAS n’est déclaré. Cette source est facultative ; ce n’est pas une panne."
              : overview.error}
          </p>
          {!notConfigured ? (
            <Button className="mt-5" onClick={() => void refresh()} disabled={refreshing}>
              <RefreshCw className={refreshing ? "animate-spin" : ""} /> Actualiser
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const stats = [
    { label: "Conteneurs", value: overview.counters.total, icon: Boxes, tone: "cyan" },
    {
      label: "En cours",
      value: overview.counters.running,
      icon: CircleCheck,
      tone: "emerald",
    },
    { label: "Arrêtés", value: overview.counters.stopped, icon: Square, tone: "zinc" },
    {
      label: "Alertes",
      value: overview.counters.unhealthy,
      icon: CircleAlert,
      tone: "rose",
    },
    { label: "Images", value: overview.engine.images, icon: HardDrive, tone: "violet" },
  ] as const;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-cyan-300/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_42%),rgba(9,12,18,0.78)] p-5 shadow-2xl shadow-black/20">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-200">
              <Server className="size-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{overview.engine.name}</h2>
                <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                  <span className="mr-1.5 size-1.5 rounded-full bg-emerald-400" />{" "}
                  Connecté
                </Badge>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {overview.engine.operatingSystem ?? overview.engine.os} · Docker{" "}
                {overview.engine.version}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
            <span className="rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2">
              {overview.engine.cpus} CPU
            </span>
            <span className="rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2">
              {formatBytes(overview.engine.memoryBytes)} RAM
            </span>
            <span className="rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2">
              API {overview.engine.apiVersion}
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="overflow-hidden">
            <CardContent className="relative p-4">
              <div
                className={cn(
                  "absolute -top-8 -right-8 size-24 rounded-full blur-3xl",
                  tone === "cyan" && "bg-cyan-400/15",
                  tone === "emerald" && "bg-emerald-400/15",
                  tone === "rose" && "bg-rose-400/15",
                  tone === "violet" && "bg-violet-400/15",
                  tone === "zinc" && "bg-zinc-400/10",
                )}
              />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500">{label}</p>
                  <p className="mt-1 text-2xl font-semibold">{value}</p>
                </div>
                <Icon className="size-5 text-zinc-500" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-black/15 p-3 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 pr-3 pl-9 text-sm outline-none focus:border-cyan-300/30"
              aria-label="Rechercher un conteneur"
              placeholder="Rechercher un conteneur, une image ou un projet…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              className="h-10 rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm"
              aria-label="Filtrer par état"
              value={state}
              onChange={(event) => setState(event.target.value)}
            >
              <option value="all">Tous les états</option>
              <option value="running">En cours</option>
              <option value="stopped">Arrêtés</option>
            </select>
            <select
              className="h-10 rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm"
              aria-label="Filtrer par santé"
              value={health}
              onChange={(event) => setHealth(event.target.value)}
            >
              <option value="all">Toutes les santés</option>
              <option value="healthy">Sains</option>
              <option value="unhealthy">Non sains</option>
              <option value="starting">Démarrage</option>
              <option value="none">Sans healthcheck</option>
            </select>
            <Button
              variant="outline"
              size="lg"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} /> Actualiser
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-zinc-500">
          <span>
            {containers.length} conteneur{containers.length > 1 ? "s" : ""} affiché
            {containers.length > 1 ? "s" : ""}
          </span>
          <span aria-live="polite">
            Mis à jour à {new Date(overview.fetchedAt).toLocaleTimeString("fr-FR")}
            {overview.partial ? " · données partielles" : ""}
            {refreshError ? ` · ${refreshError}` : ""}
          </span>
        </div>

        {actionMessage ? (
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border px-4 py-3 text-sm",
              actionMessage.tone === "success"
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                : "border-rose-400/20 bg-rose-400/10 text-rose-100",
            )}
            role="status"
          >
            <span>{actionMessage.text}</span>
            <button aria-label="Fermer le message" onClick={() => setActionMessage(null)}>
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-2">
          {containers.map((container) => {
            const style = statusStyle(container);
            const protectedContainer = isProtected(container);
            const cpu = container.metrics?.cpuPercent ?? 0;
            const memory = container.metrics?.memoryPercent ?? 0;
            return (
              <article
                key={container.id}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#090d12]/80 p-4 transition hover:-translate-y-0.5 hover:border-white/[0.13] hover:shadow-xl hover:shadow-black/25"
              >
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent opacity-60",
                    style.glow,
                  )}
                />
                <div className="relative flex items-start gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-black/30 text-zinc-300">
                    <Container className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold">{container.name}</h2>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {container.image}
                        </p>
                      </div>
                      <Badge className={cn("shrink-0", style.badge)}>
                        <span className={cn("mr-1.5 size-1.5 rounded-full", style.dot)} />
                        {style.label}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-zinc-500">
                            <Cpu className="size-3.5" /> CPU
                          </span>
                          <span>{container.metrics ? `${cpu.toFixed(1)} %` : "—"}</span>
                        </div>
                        <Meter value={cpu} tone="cyan" />
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-zinc-500">
                            <MemoryStick className="size-3.5" /> RAM
                          </span>
                          <span>
                            {container.metrics ? `${memory.toFixed(1)} %` : "—"}
                          </span>
                        </div>
                        <Meter value={memory} tone="violet" />
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.05] bg-black/20 p-3 text-xs">
                      <div>
                        <dt className="text-zinc-600">Uptime</dt>
                        <dd className="mt-1 text-zinc-300">
                          {formatUptime(container.uptimeSeconds)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-600">Redémarrages</dt>
                        <dd className="mt-1 text-zinc-300">{container.restartCount}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-600">Ports</dt>
                        <dd className="mt-1 truncate text-zinc-300">
                          {container.ports
                            .filter((port) => port.publicPort)
                            .map((port) => port.publicPort)
                            .join(", ") || "—"}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-xs text-zinc-600">
                        {container.composeProject && container.composeService
                          ? `${container.composeProject} / ${container.composeService}`
                          : "Hors projet Compose"}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {container.serviceUrl ? (
                          <Button
                            asChild
                            variant="ghost"
                            size="icon-sm"
                            title="Ouvrir le service"
                          >
                            <a
                              href={container.serviceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink />
                            </a>
                          </Button>
                        ) : null}
                        {canControl && protectedContainer ? (
                          <span
                            className="flex items-center gap-1.5 px-2 text-xs text-zinc-500"
                            title="Protégé pour maintenir VestyHub disponible"
                          >
                            <LockKeyhole className="size-3.5" /> Protégé
                          </span>
                        ) : null}
                        {canControl &&
                        !protectedContainer &&
                        container.state !== "running" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pendingAction !== null}
                            onClick={() => void runAction(container, "start")}
                          >
                            <Play /> Démarrer
                          </Button>
                        ) : null}
                        {canControl &&
                        !protectedContainer &&
                        container.state === "running" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Redémarrer"
                              disabled={pendingAction !== null}
                              onClick={() =>
                                setConfirmAction({ container, action: "restart" })
                              }
                            >
                              <RefreshCw />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              title="Arrêter"
                              disabled={pendingAction !== null}
                              onClick={() =>
                                setConfirmAction({ container, action: "stop" })
                              }
                            >
                              <Square />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {container.warning ? (
                      <p className="mt-2 text-xs text-amber-300">{container.warning}</p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {containers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center">
            <Activity className="mx-auto size-7 text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-500">
              Aucun conteneur ne correspond aux filtres.
            </p>
          </div>
        ) : null}
      </section>

      {confirmAction ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setConfirmAction(null)
          }
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c1118] p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="docker-confirm-title"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl",
                  confirmAction.action === "stop"
                    ? "bg-rose-400/10 text-rose-300"
                    : "bg-amber-300/10 text-amber-200",
                )}
              >
                {confirmAction.action === "stop" ? (
                  <Square className="size-4" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </div>
              <div>
                <h2 id="docker-confirm-title" className="font-semibold">
                  {ACTION_LABELS[confirmAction.action]} {confirmAction.container.name} ?
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {confirmAction.action === "stop"
                    ? "Le service deviendra indisponible jusqu’à son prochain démarrage."
                    : "Le service sera brièvement indisponible pendant son redémarrage."}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmAction(null)}>
                Annuler
              </Button>
              <Button
                variant={confirmAction.action === "stop" ? "destructive" : "default"}
                disabled={pendingAction !== null}
                onClick={() =>
                  void runAction(confirmAction.container, confirmAction.action)
                }
              >
                {pendingAction ? <RefreshCw className="animate-spin" /> : null} Confirmer
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
