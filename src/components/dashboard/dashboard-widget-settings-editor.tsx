"use client";

import { Save, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MONITORING_RANGES, type MonitoringRange } from "@/connectors/monitoring/types";
import {
  resolveDashboardWidgetConfiguration,
  type DashboardWidgetType,
} from "@/lib/dashboard/widget-catalog";

type SettingsDraft = Record<string, boolean | number | string>;

const MONITORING_RANGE_LABELS: Record<MonitoringRange, string> = {
  "1h": "1 heure",
  "6h": "6 heures",
  "24h": "24 heures",
  "7d": "7 jours",
};

export function DashboardWidgetSettingsEditor({
  dashboardId,
  type,
  configuration,
  onSaved,
  onCancel,
}: {
  dashboardId: string;
  type: DashboardWidgetType;
  configuration: unknown;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const resolvedConfiguration = resolveDashboardWidgetConfiguration(type, configuration);
  const [draft, setDraft] = useState<SettingsDraft>(() => ({
    ...resolvedConfiguration,
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const systemStatusHasSelection =
    type !== "system-status" ||
    draft.showDatabase === true ||
    draft.showDocker === true ||
    draft.showSession === true;

  async function saveSettings() {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/widgets/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          dashboardId,
          type,
          configuration: draft,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? `Enregistrement refusé (${response.status}).`);
      }

      onSaved();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Impossible d’enregistrer les paramètres.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function setBooleanSetting(key: string, value: boolean) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="border-border/60 bg-surface-elevated/45 mt-3 rounded-lg border p-3">
      {type === "clock" ? (
        <div className="space-y-2">
          <SettingCheckbox
            label="Afficher les secondes"
            checked={draft.showSeconds === true}
            onChange={(checked) => setBooleanSetting("showSeconds", checked)}
          />
          <SettingCheckbox
            label="Afficher la date"
            checked={draft.showDate === true}
            onChange={(checked) => setBooleanSetting("showDate", checked)}
          />
          <SettingCheckbox
            label="Format 12 heures"
            checked={draft.hour12 === true}
            onChange={(checked) => setBooleanSetting("hour12", checked)}
          />
        </div>
      ) : null}

      {type === "favorites" ? (
        <label className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
          <span>Favoris affichés</span>
          <input
            type="number"
            min={1}
            max={8}
            step={1}
            value={Number(draft.limit ?? 6)}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                limit: Number(event.target.value),
              }))
            }
            className="border-border bg-background text-foreground focus-visible:ring-primary h-8 w-16 rounded-md border px-2 text-center text-sm outline-none focus-visible:ring-2"
            aria-label="Nombre de favoris affichés"
          />
        </label>
      ) : null}

      {type === "system-status" ? (
        <div className="space-y-2">
          <SettingCheckbox
            label="PostgreSQL"
            checked={draft.showDatabase === true}
            onChange={(checked) => setBooleanSetting("showDatabase", checked)}
          />
          <SettingCheckbox
            label="Docker proxy"
            checked={draft.showDocker === true}
            onChange={(checked) => setBooleanSetting("showDocker", checked)}
          />
          <SettingCheckbox
            label="Session"
            checked={draft.showSession === true}
            onChange={(checked) => setBooleanSetting("showSession", checked)}
          />
          {!systemStatusHasSelection ? (
            <p className="text-warning text-[11px]">
              Garde au moins un bloc de statut affiché.
            </p>
          ) : null}
        </div>
      ) : null}

      {type === "monitoring" ? (
        <div className="space-y-3">
          <label className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
            <span>Période des métriques</span>
            <select
              value={String(draft.range ?? "1h")}
              onChange={(event) =>
                setDraft((current) => ({ ...current, range: event.target.value }))
              }
              className="border-border bg-background text-foreground focus-visible:ring-primary h-8 rounded-md border px-2 text-xs outline-none focus-visible:ring-2"
              aria-label="Période du widget monitoring"
            >
              {MONITORING_RANGES.map((range) => (
                <option key={range} value={range}>
                  {MONITORING_RANGE_LABELS[range]}
                </option>
              ))}
            </select>
          </label>
          <SettingCheckbox
            label="Afficher les alertes"
            checked={draft.showAlerts === true}
            onChange={(checked) => setBooleanSetting("showAlerts", checked)}
          />
          <SettingCheckbox
            label="Afficher l’état des sources"
            checked={draft.showSources === true}
            onChange={(checked) => setBooleanSetting("showSources", checked)}
          />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => void saveSettings()}
          disabled={isSaving || !systemStatusHasSelection}
        >
          <Save aria-hidden="true" />
          {isSaving ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X aria-hidden="true" />
          Annuler
        </Button>
      </div>

      <div className="mt-2 min-h-4 text-xs" aria-live="polite">
        {error ? <span className="text-destructive">{error}</span> : null}
      </div>
    </div>
  );
}

function SettingCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="text-muted-foreground flex cursor-pointer items-center justify-between gap-3 text-xs">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-primary size-4"
      />
    </label>
  );
}
