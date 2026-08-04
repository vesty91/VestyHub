import { Activity, Container, Database, ShieldCheck } from "lucide-react";

import type { DockerOverview } from "@/connectors/docker/client";

export function StatusWidget({
  docker,
  databaseReady,
}: {
  docker: DockerOverview;
  databaseReady: boolean;
}) {
  const checks = [
    {
      label: "PostgreSQL",
      detail: databaseReady ? "Opérationnel" : "Indisponible",
      healthy: databaseReady,
      icon: Database,
    },
    {
      label: "Docker proxy",
      detail: docker.available ? "Lecture seule" : "Non joignable",
      healthy: docker.available,
      icon: Container,
    },
    {
      label: "Session",
      detail: "Protégée",
      healthy: true,
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Statut général</p>
          <p className="text-xs text-zinc-500">Services essentiels</p>
        </div>
        <Activity className="size-4 text-emerald-300" />
      </div>
      <div className="space-y-2">
        {checks.map((check) => (
          <div
            key={check.label}
            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2.5"
          >
            <div className="grid size-8 place-items-center rounded-lg bg-white/[0.04]">
              <check.icon className="size-4 text-zinc-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{check.label}</p>
              <p className="text-[11px] text-zinc-500">{check.detail}</p>
            </div>
            <span
              className={`size-2 rounded-full ${
                check.healthy
                  ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]"
                  : "bg-red-400"
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
