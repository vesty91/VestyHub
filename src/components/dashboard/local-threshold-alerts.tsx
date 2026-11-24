"use client";

import { Activity, AlertTriangle } from "lucide-react";

import {
  RESOURCE_THRESHOLD_OPTIONS,
  type ResourceAlertState,
  type ResourceKey,
  type ResourceThresholds,
} from "@/lib/local-system/alerts";

type Props = {
  thresholds: ResourceThresholds;
  state: ResourceAlertState;
  metricsAvailable: boolean;
  onThresholdChange: (resource: ResourceKey, value: number) => void;
};

export function LocalThresholdAlerts({
  thresholds,
  state,
  metricsAvailable,
  onThresholdChange,
}: Props) {
  const warnings = [
    state.cpu.active ? "CPU" : null,
    state.memory.active ? "RAM" : null,
  ].filter((value): value is string => value !== null);

  return (
    <div
      className={
        warnings.length && metricsAvailable
          ? "rounded-xl border border-amber-400/35 bg-amber-400/[0.07] p-3"
          : "border-border/70 bg-surface-elevated/20 rounded-xl border p-3"
      }
      aria-label="Surveillance des seuils CPU et RAM"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          {warnings.length && metricsAvailable ? (
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-amber-300"
              aria-hidden="true"
            />
          ) : (
            <Activity
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          )}
          <div>
            <p className="text-sm font-medium">Alertes ressources locales</p>
            <p
              className="text-muted-foreground mt-0.5 text-xs"
              role="status"
              aria-live="polite"
            >
              {!metricsAvailable
                ? "Mesures indisponibles : aucune nouvelle alerte."
                : warnings.length
                  ? `Charge élevée confirmée : ${warnings.join(" et ")}.`
                  : "Aucune surcharge confirmée."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {(["cpu", "memory"] as const).map((resource) => (
            <label
              key={resource}
              className="text-muted-foreground flex items-center gap-2 text-xs"
            >
              <span>Seuil {resource === "cpu" ? "CPU" : "RAM"}</span>
              <select
                aria-label={`Seuil d’alerte ${resource === "cpu" ? "CPU" : "RAM"}`}
                value={thresholds[resource]}
                onChange={(event) =>
                  onThresholdChange(resource, Number(event.target.value))
                }
                className="border-border bg-background text-foreground h-8 rounded-md border px-2"
              >
                {RESOURCE_THRESHOLD_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value} %
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>
      <p className="text-muted-foreground mt-2 text-[11px]">
        Deux mesures successives au-dessus du seuil déclenchent l’alerte. Deux mesures au
        moins 5 points sous le seuil la réinitialisent. Aucun message système ni arrêt de
        service. Paramètres temporaires pour cet onglet.
      </p>
    </div>
  );
}
