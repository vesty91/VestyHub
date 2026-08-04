import Link from "next/link";
import { AlertTriangle, BellRing, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel, PanelHeader, StatusDot } from "@/components/vestyhub/primitives";
import {
  getActiveAlerts,
  getAlertmanagerStatus,
  summarizeAlerts,
} from "@/connectors/monitoring/alertmanager";
import type { MonitoringAlert } from "@/connectors/monitoring/types";
import { requireUser } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

function AlertCard({ alert }: { alert: MonitoringAlert }) {
  return (
    <li>
      <Panel>
        <PanelHeader
          title={alert.name}
          subtitle={alert.source ?? "Source non précisée"}
          icon={<AlertTriangle className="size-4" />}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StatusDot
                label={alert.state === "pending" ? "En attente" : "Déclenchée"}
                tone={alert.state === "pending" ? "warning" : "danger"}
                pulse={alert.state === "firing"}
              />
              <Badge variant="outline" className="capitalize">
                {alert.severity}
              </Badge>
            </div>
          }
        />
        {alert.summary ? <p className="text-sm leading-6">{alert.summary}</p> : null}
        <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-4 text-xs">
          {alert.startsAt ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              Depuis le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(alert.startsAt))}
            </span>
          ) : null}
          <span className="capitalize">Sévérité : {alert.severity}</span>
        </div>
        {Object.keys(alert.labels).length > 0 ? (
          <dl className="mt-4 flex flex-wrap gap-2">
            {Object.entries(alert.labels)
              .filter(([key]) => !["alertname", "severity"].includes(key))
              .slice(0, 8)
              .map(([key, value]) => (
                <div key={key} className="bg-secondary/60 rounded-lg px-2 py-1 text-xs">
                  <dt className="text-muted-foreground inline">{key}=</dt>
                  <dd className="inline">{value}</dd>
                </div>
              ))}
          </dl>
        ) : null}
      </Panel>
    </li>
  );
}

export default async function MonitoringAlertsPage() {
  await requireUser();
  const status = await getAlertmanagerStatus();
  let alerts: MonitoringAlert[] = [];
  let loadError = false;

  if (status.available) {
    try {
      alerts = await getActiveAlerts();
    } catch {
      loadError = true;
    }
  }

  const summary = summarizeAlerts(alerts);

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <PageHeader
        title="Alertes"
        description="Alertes actives lues depuis Alertmanager. Aucun silence, acquittement ou changement de règle n’est exposé."
        eyebrow={
          <Badge variant="outline" className="text-primary">
            Alertmanager · lecture seule
          </Badge>
        }
        actions={
          <Link href="/monitoring" className="text-primary text-sm font-medium">
            Retour au monitoring
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-3" aria-label="Résumé des alertes">
        <Panel>
          <PanelHeader title="Source" icon={<BellRing className="size-4" />} />
          <StatusDot
            label={status.available ? "Disponible" : "Indisponible"}
            tone={status.available ? "success" : "danger"}
            pulse={status.available}
          />
        </Panel>
        <Panel>
          <p className="text-muted-foreground text-xs uppercase">Déclenchées</p>
          <p className="text-destructive mt-3 text-3xl font-semibold">{summary.firing}</p>
        </Panel>
        <Panel>
          <p className="text-muted-foreground text-xs uppercase">En attente</p>
          <p className="text-warning mt-3 text-3xl font-semibold">{summary.pending}</p>
        </Panel>
      </section>

      {!status.available || loadError ? (
        <Panel>
          <div className="border-destructive/25 bg-destructive/8 text-muted-foreground rounded-xl border px-4 py-10 text-center text-sm">
            Alertmanager ne répond pas actuellement.
          </div>
        </Panel>
      ) : alerts.length === 0 ? (
        <Panel>
          <div className="border-success/25 bg-success/8 rounded-xl border px-4 py-12 text-center">
            <StatusDot label="Aucune alerte active" tone="success" pulse />
          </div>
        </Panel>
      ) : (
        <ul className="grid gap-4">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </ul>
      )}
    </div>
  );
}
