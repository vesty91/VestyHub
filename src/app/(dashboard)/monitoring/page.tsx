import { Activity, BellRing, ChartNoAxesCombined } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getEnv } from "@/lib/env";

export default function MonitoringPage() {
  const env = getEnv();
  const sources = [
    { name: "Prometheus", url: env.PROMETHEUS_URL, icon: ChartNoAxesCombined },
    { name: "Loki", url: env.LOKI_URL, icon: Activity },
    { name: "Alertmanager", url: env.ALERTMANAGER_URL, icon: BellRing },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Monitoring</h1>
        <p className="mt-2 text-sm text-zinc-500">
          État de préparation des sources de métriques, logs et alertes.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {sources.map((source) => (
          <Card key={source.name}>
            <CardContent>
              <div className="flex items-center justify-between">
                <source.icon className="size-5 text-cyan-300" />
                <span
                  className={`size-2 rounded-full ${source.url ? "bg-emerald-400" : "bg-zinc-600"}`}
                />
              </div>
              <p className="mt-5 font-medium">{source.name}</p>
              <p className="mt-1 text-xs break-all text-zinc-500">
                {source.url || "Source non configurée"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <ChartNoAxesCombined className="mx-auto mb-3 size-8 text-zinc-600" />
          <p className="font-medium">Widgets historiques en préparation</p>
          <p className="mt-2 text-sm text-zinc-500">
            Les clients Prometheus, Loki et Alertmanager seront ajoutés après validation
            des sources réelles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
