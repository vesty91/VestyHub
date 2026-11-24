"use client";

import { Activity } from "lucide-react";

import {
  RESOURCE_HISTORY_WINDOW_MS,
  type ResourceHistoryPoint,
} from "@/lib/local-system/history";

const WIDTH = 640;
const HEIGHT = 150;
const PAD = 8;

function linePath(
  points: readonly ResourceHistoryPoint[],
  field: "cpu" | "memory",
): string {
  if (!points.length) return "";
  const latest = Date.parse(points[points.length - 1].sampledAt);
  const start = latest - RESOURCE_HISTORY_WINDOW_MS;
  return points
    .map((point, index) => {
      const time = Date.parse(point.sampledAt);
      const x = PAD + ((time - start) / RESOURCE_HISTORY_WINDOW_MS) * (WIDTH - 2 * PAD);
      const y = PAD + ((100 - point[field]) / 100) * (HEIGHT - 2 * PAD);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function LocalResourceHistory({
  points,
}: {
  points: readonly ResourceHistoryPoint[];
}) {
  const latest = points.at(-1);

  return (
    <section
      className="border-border/70 bg-surface-elevated/25 rounded-2xl border p-4 sm:p-5"
      aria-labelledby="local-resource-history-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Activity className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden="true" />
          <div>
            <h2 id="local-resource-history-title" className="text-base font-semibold">
              Historique CPU et RAM
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Cinq dernières minutes · mesures Windows réelles, conservées dans cet onglet
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-cyan-400" aria-hidden="true" /> CPU
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-violet-400" aria-hidden="true" />{" "}
            RAM
          </span>
        </div>
      </div>
      <div
        className="mt-4 overflow-hidden rounded-lg"
        role="img"
        aria-label={
          latest
            ? `Évolution sur cinq minutes. Dernier CPU : ${latest.cpu} pour cent, RAM : ${latest.memory} pour cent. ${points.length} relevés.`
            : "Historique CPU et RAM : en attente des premiers relevés."
        }
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-36 w-full"
          aria-hidden="true"
        >
          {[25, 50, 75].map((usage) => (
            <line
              key={usage}
              x1={0}
              x2={WIDTH}
              y1={PAD + ((100 - usage) / 100) * (HEIGHT - PAD * 2)}
              y2={PAD + ((100 - usage) / 100) * (HEIGHT - PAD * 2)}
              stroke="currentColor"
              className="text-muted-foreground/20"
              strokeWidth={1}
              strokeDasharray="4 6"
            />
          ))}
          {points.length >= 2 ? (
            <>
              <path
                data-testid="history-cpu"
                d={linePath(points, "cpu")}
                stroke="#22d3ee"
                strokeWidth={3}
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
              <path
                data-testid="history-memory"
                d={linePath(points, "memory")}
                stroke="#a78bfa"
                strokeWidth={3}
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : null}
        </svg>
      </div>
      <div className="text-muted-foreground mt-2 flex items-center justify-between gap-3 text-[11px]">
        <span>Il y a 5 min</span>
        <span>
          {latest
            ? `${points.length} relevé${points.length > 1 ? "s" : ""} · dernier à ${new Date(latest.sampledAt).toLocaleTimeString("fr-FR")}`
            : "Premier relevé en cours…"}
        </span>
        <span>Maintenant</span>
      </div>
      <p className="text-muted-foreground mt-2 text-[11px]">
        Historique temporaire, effacé au rechargement. Aucune donnée envoyée à un nouveau
        service.
      </p>
    </section>
  );
}
