"use client";

import { Activity, HardDrive, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { LocalProcessSnapshot } from "@/lib/local-system/processes";

const POLL_MS = 30_000;

function formatMemory(bytes: number): string {
  return (
    (bytes / 1024 ** 2).toLocaleString("fr-FR", {
      maximumFractionDigits: 0,
    }) + " Mio"
  );
}

export function LocalTopProcesses() {
  const [snapshot, setSnapshot] = useState<LocalProcessSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPending(true);

    try {
      const response = await fetch("/api/local/processes", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Process sampling request failed");

      const payload = (await response.json()) as {
        version: number;
        data?: LocalProcessSnapshot;
      };
      if (!mountedRef.current || controller.signal.aborted) return;

      const data = payload?.data;
      if (
        !data ||
        !Array.isArray(data.processes) ||
        data.processes.some(
          (process) =>
            typeof process.name !== "string" ||
            !Number.isInteger(process.pid) ||
            !Number.isFinite(process.memoryBytes),
        )
      ) {
        throw new Error("Invalid process sample");
      }

      setSnapshot(data);
      setError(null);
    } catch {
      if (mountedRef.current && !controller.signal.aborted) {
        setError("Impossible de lire les processus Windows.");
      }
    } finally {
      if (mountedRef.current && !controller.signal.aborted) setPending(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const first = window.setTimeout(() => void refresh(), 0);
    const recurring = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      window.clearTimeout(first);
      window.clearInterval(recurring);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const processes = snapshot?.processes ?? [];
  const maxBytes = processes[0]?.memoryBytes ?? 0;

  return (
    <section
      className="border-border/70 bg-surface-elevated/25 rounded-2xl border p-4 sm:p-5"
      aria-labelledby="windows-processes-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-xl">
            <Activity className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="windows-processes-title" className="text-base font-semibold">
              Processus les plus gourmands en RAM
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Top 5 Windows · mémoire résidente (working set) · lecture seule
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={pending}
          className="border-border hover:bg-surface-elevated inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition disabled:opacity-60"
          aria-label="Actualiser les processus Windows"
        >
          <RefreshCw
            className={"size-3.5 " + (pending ? "animate-spin" : "")}
            aria-hidden="true"
          />
          Actualiser
        </button>
      </div>

      {processes.length ? (
        <ol className="mt-4 grid gap-2">
          {processes.map((process) => (
            <li
              key={process.pid}
              className="border-border/60 bg-background/35 flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5"
            >
              <span className="text-muted-foreground grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-xs">
                <HardDrive className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium" title={process.name}>
                    {process.name}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatMemory(process.memoryBytes)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                    PID {process.pid}
                  </span>
                  <div
                    className="bg-secondary h-1.5 min-w-0 flex-1 overflow-hidden rounded-full"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-cyan-400/85"
                      style={{
                        width:
                          maxBytes > 0
                            ? Math.min(100, (process.memoryBytes / maxBytes) * 100) + "%"
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">
          {error ??
            (pending ? "Lecture des processus Windows…" : "Aucun processus disponible.")}
        </p>
      )}

      <p className="text-muted-foreground mt-3 text-[11px]" aria-live="polite">
        {snapshot
          ? "Dernier relevé : " + new Date(snapshot.sampledAt).toLocaleTimeString("fr-FR")
          : "Relevé non encore disponible"}
        {" · "}Actualisation toutes les 30 secondes
        {error ? " · " + error : ""}
      </p>
      <p className="text-muted-foreground mt-1 text-[11px]">
        Valeurs par processus non additionnables : certaines pages mémoire sont partagées.
        Aucune commande de fermeture n’est proposée.
      </p>
    </section>
  );
}
