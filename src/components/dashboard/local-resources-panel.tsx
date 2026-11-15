"use client";

import { Activity, Cpu, HardDrive, MemoryStick, RefreshCw, Server } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { LocalResources } from "@/lib/local-system/metrics";

type Availability = "checking" | "online" | "offline";
type Services = { app: Availability; database: Availability };

const INTERVAL_MS = 15_000;
const INITIAL_SERVICES: Services = { app: "checking", database: "checking" };

function asGiB(bytes: number): string {
  return (bytes / 1024 ** 3).toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  });
}

function asPercent(percent: number | undefined): string {
  return percent === undefined
    ? "—"
    : percent.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %";
}

function UsageBar({ value }: { value?: number }) {
  const percent = Number.isFinite(value) ? Math.min(100, Math.max(0, value ?? 0)) : 0;
  const tone =
    percent >= 90 ? "bg-red-400" : percent >= 75 ? "bg-amber-400" : "bg-cyan-400";

  return (
    <div
      className="bg-secondary h-1.5 overflow-hidden rounded-full"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? 0}
    >
      <div
        className={"h-full rounded-full transition-[width] duration-500 " + tone}
        style={{ width: percent + "%" }}
      />
    </div>
  );
}

function Tile({
  title,
  icon: Icon,
  value,
  detail,
  usage,
}: {
  title: string;
  icon: typeof Cpu;
  value: string;
  detail: string;
  usage?: number;
}) {
  return (
    <article className="border-border/70 bg-surface-elevated/45 min-w-0 rounded-2xl border p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-muted-foreground text-xs font-medium tracking-[0.12em] uppercase">
          {title}
        </h3>
        <Icon className="size-4 text-cyan-300" aria-hidden="true" />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
        {value}
      </div>
      {usage === undefined ? (
        <div className="mt-3 h-1.5" />
      ) : (
        <div className="mt-3">
          <UsageBar value={usage} />
        </div>
      )}
      <p className="text-muted-foreground mt-2 text-xs">{detail}</p>
    </article>
  );
}

export function LocalResourcesPanel() {
  const [resources, setResources] = useState<LocalResources | null>(null);
  const [services, setServices] = useState<Services>(INITIAL_SERVICES);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setUpdating(true);

    try {
      const [resourcesResult, appResult, databaseResult] = await Promise.allSettled([
        fetch("/api/local/resources", { cache: "no-store", signal: controller.signal }),
        fetch("/api/health/live", { cache: "no-store", signal: controller.signal }),
        fetch("/api/health/ready", { cache: "no-store", signal: controller.signal }),
      ]);

      if (!mountedRef.current || controller.signal.aborted) return;

      const nextServices: Services = {
        app:
          appResult.status === "fulfilled" && appResult.value.ok ? "online" : "offline",
        database:
          databaseResult.status === "fulfilled" && databaseResult.value.ok
            ? "online"
            : "offline",
      };
      setServices(nextServices);

      if (resourcesResult.status !== "fulfilled" || !resourcesResult.value.ok) {
        setResources(null);
        setError("Mesures Windows momentanément indisponibles.");
        return;
      }
      const payload = (await resourcesResult.value.json()) as { data?: LocalResources };
      if (!mountedRef.current || controller.signal.aborted) return;
      if (!payload?.data || !payload.data.cpu || !payload.data.memory) {
        setResources(null);
        setError("Réponse du diagnostic Windows invalide.");
        return;
      }
      setResources(payload.data);
      setError(null);
    } catch {
      if (mountedRef.current && !controller.signal.aborted) {
        setResources(null);
        setError("Impossible d’actualiser les ressources du PC.");
      }
    } finally {
      if (mountedRef.current && !controller.signal.aborted) setUpdating(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const disk =
    resources?.disks.find((item) => item.drive === "D:") ?? resources?.disks[0];
  const onlineCount =
    Number(services.app === "online") + Number(services.database === "online");
  const statusLabel =
    services.app === "checking" || services.database === "checking"
      ? "— / 2"
      : String(onlineCount) + " / 2";

  return (
    <section className="space-y-3" aria-labelledby="local-resources-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="local-resources-title" className="text-base font-semibold">
            Ressources du PC Windows
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Mesures réelles en lecture seule · actualisation toutes les 15 secondes
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={updating}
          className="border-border hover:bg-surface-elevated inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition disabled:opacity-60"
          aria-label="Actualiser les ressources du PC"
        >
          <RefreshCw
            className={"size-3.5 " + (updating ? "animate-spin" : "")}
            aria-hidden="true"
          />
          Actualiser
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          title="CPU"
          icon={Cpu}
          value={asPercent(resources?.cpu.usagePercent)}
          detail={
            resources
              ? String(resources.cpu.logicalCores) + " processeurs logiques"
              : "Mesure en cours"
          }
          usage={resources?.cpu.usagePercent}
        />
        <Tile
          title="Mémoire RAM"
          icon={MemoryStick}
          value={asPercent(resources?.memory.usagePercent)}
          detail={
            resources
              ? asGiB(resources.memory.usedBytes) +
                " / " +
                asGiB(resources.memory.totalBytes) +
                " Gio utilisés"
              : "Mesure en cours"
          }
          usage={resources?.memory.usagePercent}
        />
        <Tile
          title="Stockage"
          icon={HardDrive}
          value={asPercent(disk?.usedPercent)}
          detail={
            disk
              ? disk.drive +
                " · " +
                asGiB(disk.freeBytes) +
                " Gio libres / " +
                asGiB(disk.totalBytes) +
                " Gio"
              : "Aucun lecteur détecté"
          }
          usage={disk?.usedPercent}
        />
        <article className="border-border/70 bg-surface-elevated/45 min-w-0 rounded-2xl border p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-[0.12em] uppercase">
              Services locaux
            </h3>
            <Server className="size-4 text-cyan-300" aria-hidden="true" />
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {statusLabel}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            <ServiceIndicator label="Next.js" state={services.app} />
            <ServiceIndicator label="PostgreSQL" state={services.database} />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Disponibilité vérifiée par HTTP
          </p>
        </article>
      </div>
      <div
        className="text-muted-foreground flex flex-wrap items-center gap-2 text-[11px]"
        aria-live="polite"
      >
        <Activity className="size-3.5" aria-hidden="true" />
        {error ??
          (resources
            ? "Dernière mesure : " +
              new Date(resources.sampledAt).toLocaleTimeString("fr-FR")
            : "Collecte en cours…")}
        <span>· Pas de NAS ni proxy Docker requis</span>
      </div>
    </section>
  );
}

function ServiceIndicator({ label, state }: { label: string; state: Availability }) {
  const color =
    state === "online"
      ? "bg-emerald-400"
      : state === "offline"
        ? "bg-red-400"
        : "bg-amber-400";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={"size-2 rounded-full " + color} aria-hidden="true" />
      {label}
      <span className="sr-only">
        {state === "online"
          ? " en ligne"
          : state === "offline"
            ? " hors ligne"
            : " vérification en cours"}
      </span>
    </span>
  );
}
