"use client";

import { Activity, Database, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import type { LocalHealthWidgetConfiguration } from "@/lib/dashboard/widget-catalog";

type Probe = "checking" | "online" | "offline";

type HealthState = {
  app: Probe;
  database: Probe;
  lastChecked: string | null;
};

const INITIAL_STATE: HealthState = {
  app: "checking",
  database: "checking",
  lastChecked: null,
};

export function LocalHealthWidget({
  configuration,
}: {
  configuration: LocalHealthWidgetConfiguration;
}) {
  const [state, setState] = useState<HealthState>(INITIAL_STATE);

  useEffect(() => {
    let active = true;
    let request: AbortController | null = null;

    async function probe(url: string, signal: AbortSignal): Promise<Probe> {
      try {
        const response = await fetch(url, { cache: "no-store", signal });
        return response.ok ? "online" : "offline";
      } catch {
        return "offline";
      }
    }

    async function check() {
      request?.abort();
      const controller = new AbortController();
      request = controller;

      const [app, database] = await Promise.all([
        probe("/api/health/live", controller.signal),
        probe("/api/health/ready", controller.signal),
      ]);

      if (active && !controller.signal.aborted) {
        setState({
          app,
          database,
          lastChecked: new Date().toLocaleTimeString("fr-FR"),
        });
      }
    }

    void check();
    const timer = window.setInterval(
      () => void check(),
      configuration.refreshSeconds * 1000,
    );

    return () => {
      active = false;
      request?.abort();
      window.clearInterval(timer);
    };
  }, [configuration.refreshSeconds]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
      <div className="mb-4 flex items-start justify-between gap-3 pr-10">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Activity className="size-4 text-cyan-300" aria-hidden="true" />
            Diagnostic local
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Vérification réelle, sans connexion au NAS
          </p>
        </div>
        <RefreshCw className="size-4 text-zinc-500" aria-hidden="true" />
      </div>
      <div className="space-y-3">
        <HealthRow name="Application Next.js" state={state.app} icon={Activity} />
        <HealthRow name="PostgreSQL" state={state.database} icon={Database} />
      </div>
      {state.database === "offline" ? (
        <p className="mt-3 text-xs text-amber-300" role="status">
          Base non disponible. Vérifie le conteneur local VestyHub.
        </p>
      ) : null}
      <p className="mt-auto pt-3 text-[11px] text-zinc-500" aria-live="polite">
        {state.lastChecked
          ? `Dernier contrôle : ${state.lastChecked}`
          : "Premier contrôle en cours…"}
        {" · "}toutes les {configuration.refreshSeconds} s
      </p>
    </div>
  );
}

function HealthRow({
  name,
  state,
  icon: Icon,
}: {
  name: string;
  state: Probe;
  icon: typeof Activity;
}) {
  const label =
    state === "online"
      ? "En ligne"
      : state === "offline"
        ? "Hors ligne"
        : "Vérification…";
  const color =
    state === "online"
      ? "bg-emerald-400"
      : state === "offline"
        ? "bg-red-400"
        : "bg-amber-400";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2.5">
      <Icon className="size-4 text-zinc-400" aria-hidden="true" />
      <span className="flex-1 text-sm">{name}</span>
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={`size-2 rounded-full ${color}`} aria-hidden="true" />
    </div>
  );
}
