import { Activity, BellRing, ChartNoAxesCombined } from "lucide-react";

import { Panel, PanelHeader, StatusDot } from "@/components/vestyhub/primitives";
import { monitoringAvailability } from "@/connectors/monitoring/availability";
import { publicMonitoringErrorMessage } from "@/connectors/monitoring/errors";
import type { MonitoringSourceStatus } from "@/connectors/monitoring/types";

const sourceMeta = {
  prometheus: { label: "Prometheus", icon: ChartNoAxesCombined },
  loki: { label: "Loki", icon: Activity },
  alertmanager: { label: "Alertmanager", icon: BellRing },
} as const;

export function SourceStatus({ status }: { status: MonitoringSourceStatus }) {
  const meta = sourceMeta[status.source];
  const Icon = meta.icon;
  const availability = monitoringAvailability(status);
  const label =
    availability === "available"
      ? "Disponible"
      : availability === "unreachable"
        ? "Indisponible"
        : "Non configuré";

  return (
    <Panel>
      <PanelHeader
        title={meta.label}
        subtitle="Source interne en lecture seule"
        icon={<Icon className="size-4" />}
        action={
          <StatusDot
            label={label}
            tone={
              availability === "available"
                ? "success"
                : availability === "unreachable"
                  ? "danger"
                  : "neutral"
            }
            pulse={status.available}
          />
        }
      />
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>Dernier contrôle</span>
        <time dateTime={status.checkedAt}>
          {new Intl.DateTimeFormat("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date(status.checkedAt))}
        </time>
      </div>
      <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
        <span>Latence</span>
        <span>{status.latencyMs === undefined ? "—" : `${status.latencyMs} ms`}</span>
      </div>
      {status.errorCode ? (
        <p className="text-muted-foreground border-border mt-4 border-t pt-3 text-xs">
          {publicMonitoringErrorMessage(status.errorCode)}
        </p>
      ) : null}
    </Panel>
  );
}
