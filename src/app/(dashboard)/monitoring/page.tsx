import Link from "next/link";
import {
  Activity,
  BellRing,
  Container,
  Gauge,
  HardDrive,
  MemoryStick,
  Network,
  TriangleAlert,
} from "lucide-react";

import { SourceStatus } from "@/components/monitoring/source-status";
import { TimeRangeSelector } from "@/components/monitoring/time-range-selector";
import { TimeSeriesChart } from "@/components/monitoring/time-series-chart";
import { Badge } from "@/components/ui/badge";
import {
  PageHeader,
  Panel,
  PanelHeader,
  StatCard,
} from "@/components/vestyhub/primitives";
import { parseMonitoringRange } from "@/connectors/monitoring/range";
import type { MonitoringMetricSummary } from "@/connectors/monitoring/types";
import { requireUser } from "@/lib/auth/dal";
import { getMonitoringOverview } from "@/lib/monitoring/service";

export const dynamic = "force-dynamic";

function formatPercent(value?: number): string {
  return value === undefined
    ? "—"
    : `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function formatBytesPerSecond(value?: number): string {
  if (value === undefined) return "—";
  const units = ["o/s", "Kio/s", "Mio/s", "Gio/s"];
  let current = Math.max(0, value);
  let unit = 0;
  while (current >= 1024 && unit < units.length - 1) {
    current /= 1024;
    unit += 1;
  }
  return `${current.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ${units[unit]}`;
}

function summaryCards(summary: MonitoringMetricSummary) {
  return [
    {
      label: "CPU",
      value: formatPercent(summary.cpuPercent),
      detail: "Utilisation globale",
      icon: <Gauge className="size-4" />,
      tone: "primary" as const,
      progress: summary.cpuPercent,
    },
    {
      label: "Mémoire",
      value: formatPercent(summary.memoryPercent),
      detail: "Mémoire hôte utilisée",
      icon: <MemoryStick className="size-4" />,
      tone: "info" as const,
      progress: summary.memoryPercent,
    },
    {
      label: "Stockage",
      value: formatPercent(summary.filesystemPercent),
      detail: "Partition la plus occupée",
      icon: <HardDrive className="size-4" />,
      tone: "warning" as const,
      progress: summary.filesystemPercent,
    },
    {
      label: "Conteneurs",
      value:
        summary.runningContainers === undefined
          ? "—"
          : Math.round(summary.runningContainers).toLocaleString("fr-FR"),
      detail: "Séries cAdvisor actives",
      icon: <Container className="size-4" />,
      tone: "success" as const,
    },
  ];
}

export default async function MonitoringPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const range = parseMonitoringRange(params.range);
  const overview = await getMonitoringOverview(range);
  const cards = summaryCards(overview.summary);

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <PageHeader
        title="Monitoring"
        description="Métriques, journaux et alertes issus des sources réelles du homelab, sans aucune commande d’écriture."
        eyebrow={
          <Badge variant="outline" className="text-primary">
            Phase 3C · lecture seule
          </Badge>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/monitoring/logs"
              className="border-border bg-secondary/60 hover:bg-secondary rounded-xl border px-3 py-2 text-xs font-medium transition"
            >
              Journaux
            </Link>
            <Link
              href="/monitoring/alerts"
              className="border-border bg-secondary/60 hover:bg-secondary rounded-xl border px-3 py-2 text-xs font-medium transition"
            >
              Alertes
            </Link>
            <TimeRangeSelector value={range} />
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-3" aria-label="État des sources">
        {overview.sources.map((status) => (
          <SourceStatus key={status.source} status={status} />
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Résumé">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="CPU"
            subtitle={`Historique sur ${range}`}
            icon={<Gauge className="size-4" />}
          />
          <TimeSeriesChart
            title="Historique CPU"
            series={overview.metrics["host.cpu.usage"] ?? []}
          />
        </Panel>
        <Panel>
          <PanelHeader
            title="Mémoire"
            subtitle={`Historique sur ${range}`}
            icon={<MemoryStick className="size-4" />}
          />
          <TimeSeriesChart
            title="Historique mémoire"
            series={overview.metrics["host.memory.usage"] ?? []}
          />
        </Panel>
        <Panel>
          <PanelHeader
            title="Réseau"
            subtitle={`Entrant ${formatBytesPerSecond(overview.summary.networkReceiveBytesPerSecond)} · sortant ${formatBytesPerSecond(overview.summary.networkTransmitBytesPerSecond)}`}
            icon={<Network className="size-4" />}
          />
          <TimeSeriesChart
            title="Débit réseau"
            series={[
              ...(overview.metrics["host.network.receive"] ?? []),
              ...(overview.metrics["host.network.transmit"] ?? []),
            ]}
          />
        </Panel>
        <Panel>
          <PanelHeader
            title="Alertes actives"
            subtitle="Lecture Alertmanager"
            icon={<BellRing className="size-4" />}
            action={
              <Link
                href="/monitoring/alerts"
                className="text-primary text-xs font-medium"
              >
                Voir les alertes
              </Link>
            }
          />
          {overview.alerts ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-secondary/55 rounded-xl p-4">
                <p className="text-muted-foreground text-xs uppercase">Déclenchées</p>
                <p className="text-destructive mt-2 text-3xl font-semibold">
                  {overview.alerts.firing}
                </p>
              </div>
              <div className="bg-secondary/55 rounded-xl p-4">
                <p className="text-muted-foreground text-xs uppercase">En attente</p>
                <p className="text-warning mt-2 text-3xl font-semibold">
                  {overview.alerts.pending}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Le résumé des alertes est indisponible.
            </p>
          )}
        </Panel>
      </section>

      {overview.warnings.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Données partielles"
            subtitle="Les autres panneaux restent disponibles."
            icon={<TriangleAlert className="size-4" />}
          />
          <ul className="space-y-2 text-sm">
            {overview.warnings.map((warning, index) => (
              <li
                key={`${warning.source}:${warning.code}:${index}`}
                className="bg-warning/8 text-muted-foreground flex items-start gap-2 rounded-xl px-3 py-2"
              >
                <Activity className="text-warning mt-0.5 size-4 shrink-0" />
                <span>
                  <strong className="text-foreground capitalize">{warning.source}</strong>{" "}
                  — {warning.message}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <p className="text-muted-foreground text-right text-xs">
        Généré le{" "}
        {new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "short",
          timeStyle: "medium",
        }).format(new Date(overview.generatedAt))}
      </p>
    </div>
  );
}
