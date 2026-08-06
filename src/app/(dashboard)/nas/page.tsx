import {
  Clock3,
  Cpu,
  Database,
  Disc3,
  HardDrive,
  Layers3,
  MemoryStick,
  Network,
  Server,
  ShieldCheck,
  Thermometer,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  PageHeader,
  Panel,
  PanelHeader,
  StatCard,
  StatusDot,
} from "@/components/vestyhub/primitives";
import type { NasDisk, NasStoragePool, NasVolume } from "@/connectors/synology/types";
import { publicSynologyErrorMessage } from "@/connectors/synology/errors";
import { requireUser } from "@/lib/auth/dal";
import { getNasOverview } from "@/lib/nas/service";

export const dynamic = "force-dynamic";

function formatBytes(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  const units = ["o", "Kio", "Mio", "Gio", "Tio", "Pio"];
  let current = Math.max(0, value);
  let unit = 0;
  while (current >= 1024 && unit < units.length - 1) {
    current /= 1024;
    unit += 1;
  }
  return `${current.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ${units[unit]}`;
}

function formatPercent(value?: number): string {
  return value === undefined
    ? "—"
    : `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function formatUptime(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return "—";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return [days ? `${days} j` : "", hours ? `${hours} h` : "", `${minutes} min`]
    .filter(Boolean)
    .join(" ");
}

function aggregateVolumes(volumes: NasVolume[]) {
  const totalBytes = volumes.reduce((sum, volume) => sum + (volume.totalBytes ?? 0), 0);
  const usedBytes = volumes.reduce((sum, volume) => sum + (volume.usedBytes ?? 0), 0);
  return {
    totalBytes: totalBytes || undefined,
    usedBytes: usedBytes || undefined,
    usagePercent:
      totalBytes > 0
        ? Math.min(100, Math.max(0, (usedBytes / totalBytes) * 100))
        : undefined,
  };
}

function StorageBar({ usagePercent }: { usagePercent?: number }) {
  const normalized =
    usagePercent === undefined ? undefined : Math.min(100, Math.max(0, usagePercent));
  return (
    <div className="bg-secondary mt-3 h-1.5 overflow-hidden rounded-full">
      {normalized !== undefined ? (
        <div
          className="bg-primary h-full rounded-full transition-[width]"
          style={{ width: `${normalized}%` }}
        />
      ) : null}
    </div>
  );
}

function VolumeCard({ volume }: { volume: NasVolume }) {
  return (
    <Panel interactive>
      <PanelHeader
        title={volume.name}
        subtitle={volume.filesystem ?? volume.id}
        icon={<Database className="size-4" />}
        action={
          <StatusDot
            label={volume.status ?? "État inconnu"}
            tone={volume.status?.toLowerCase().includes("normal") ? "success" : "neutral"}
          />
        }
      />
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Utilisé</p>
          <p className="mt-1 font-medium">{formatBytes(volume.usedBytes)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Capacité</p>
          <p className="mt-1 font-medium">{formatBytes(volume.totalBytes)}</p>
        </div>
      </div>
      <StorageBar usagePercent={volume.usagePercent} />
      <p className="text-muted-foreground mt-2 text-right text-xs">
        {formatPercent(volume.usagePercent)} occupé
      </p>
    </Panel>
  );
}

function PoolCard({ pool }: { pool: NasStoragePool }) {
  return (
    <Panel interactive>
      <PanelHeader
        title={pool.name}
        subtitle={pool.raidType ?? pool.id}
        icon={<Layers3 className="size-4" />}
        action={
          <StatusDot
            label={pool.status ?? "État inconnu"}
            tone={pool.status?.toLowerCase().includes("normal") ? "success" : "neutral"}
          />
        }
      />
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Utilisation</span>
        <strong>{formatPercent(pool.usagePercent)}</strong>
      </div>
      <StorageBar usagePercent={pool.usagePercent} />
      <p className="text-muted-foreground mt-2 text-xs">
        {formatBytes(pool.usedBytes)} sur {formatBytes(pool.totalBytes)}
      </p>
    </Panel>
  );
}

function DiskRow({ disk }: { disk: NasDisk }) {
  const healthy = [disk.status, disk.smartStatus]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .match(/normal|healthy|good/);

  return (
    <li className="border-border grid gap-3 border-b py-4 last:border-b-0 md:grid-cols-[1.1fr_1.4fr_1fr_1fr] md:items-center">
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-xl">
          <Disc3 className="size-4" />
        </span>
        <div>
          <p className="font-medium">{disk.name}</p>
          <p className="text-muted-foreground text-xs">{disk.type ?? disk.id}</p>
        </div>
      </div>
      <div>
        <p className="text-sm">{disk.model ?? "Modèle non fourni"}</p>
        <p className="text-muted-foreground text-xs">
          {disk.serial ?? "Série non fournie"}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Capacité</p>
        <p className="mt-1 text-sm font-medium">{formatBytes(disk.sizeBytes)}</p>
      </div>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
          <Thermometer className="size-3.5" />
          {disk.temperatureCelsius === undefined ? "—" : `${disk.temperatureCelsius} °C`}
        </span>
        <StatusDot
          label={disk.smartStatus ?? disk.status ?? "Inconnu"}
          tone={healthy ? "success" : "neutral"}
        />
      </div>
    </li>
  );
}

export default async function NasPage() {
  await requireUser();
  const overview = await getNasOverview();
  const storage = aggregateVolumes(overview.volumes);
  const statusLabel = overview.status.available
    ? "DSM disponible"
    : overview.status.enabled
      ? "DSM indisponible"
      : "Connecteur désactivé";

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <PageHeader
        title="NAS Synology"
        description="Identité DSM, stockage et santé matérielle collectés côté serveur avec une session dédiée en lecture seule."
        eyebrow={
          <Badge variant="outline" className="text-primary">
            Phase 3D · {overview.status.mode}
          </Badge>
        }
        actions={
          <StatusDot
            label={statusLabel}
            tone={
              overview.status.available
                ? "success"
                : overview.status.enabled
                  ? "danger"
                  : "warning"
            }
            pulse={overview.status.available}
          />
        }
      />

      <section className="grid gap-4 md:grid-cols-3" aria-label="État DSM">
        <Panel>
          <PanelHeader
            title="Connexion DSM"
            subtitle="Source configurée côté serveur"
            icon={<Server className="size-4" />}
          />
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Endpoint</dt>
              <dd className="font-medium">{overview.status.endpointHost ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Latence</dt>
              <dd className="font-medium">
                {overview.status.latencyMs === undefined
                  ? "—"
                  : `${overview.status.latencyMs} ms`}
              </dd>
            </div>
          </dl>
        </Panel>
        <Panel>
          <PanelHeader
            title="Transport"
            subtitle="Protection de la connexion"
            icon={<ShieldCheck className="size-4" />}
          />
          <StatusDot
            label={overview.status.tlsVerified ? "TLS vérifié" : "TLS non vérifié"}
            tone={overview.status.tlsVerified ? "success" : "warning"}
          />
          <p className="text-muted-foreground mt-4 text-xs">
            Aucun identifiant, SID ou SynoToken n’est envoyé au navigateur.
          </p>
        </Panel>
        <Panel>
          <PanelHeader
            title="Capacités DSM"
            subtitle="Découvertes via SYNO.API.Info"
            icon={<Cpu className="size-4" />}
          />
          <p className="text-3xl font-semibold">{overview.capabilities.length}</p>
          <p className="text-muted-foreground mt-2 text-xs">API autorisées disponibles</p>
        </Panel>
      </section>

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Résumé NAS"
      >
        <StatCard
          label="CPU"
          value={formatPercent(overview.utilization?.cpuPercent)}
          detail="Utilisation DSM"
          icon={<Cpu className="size-4" />}
          tone="primary"
          progress={overview.utilization?.cpuPercent}
        />
        <StatCard
          label="Mémoire"
          value={formatPercent(overview.utilization?.memoryPercent)}
          detail="Mémoire NAS utilisée"
          icon={<MemoryStick className="size-4" />}
          tone="info"
          progress={overview.utilization?.memoryPercent}
        />
        <StatCard
          label="Stockage"
          value={formatPercent(storage.usagePercent)}
          detail={`${formatBytes(storage.usedBytes)} sur ${formatBytes(storage.totalBytes)}`}
          icon={<HardDrive className="size-4" />}
          tone={
            storage.usagePercent !== undefined && storage.usagePercent >= 90
              ? "warning"
              : "success"
          }
          progress={storage.usagePercent}
        />
        <StatCard
          label="Disques"
          value={overview.disks.length || "—"}
          detail={`${overview.volumes.length} volume${overview.volumes.length > 1 ? "s" : ""}`}
          icon={<Disc3 className="size-4" />}
          tone="success"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <PanelHeader
            title="Système"
            subtitle="Identité retournée par DSM"
            icon={<Server className="size-4" />}
          />
          {overview.system ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ["Nom", overview.system.hostname],
                ["Modèle", overview.system.model],
                ["DSM", overview.system.dsmVersion],
                ["Architecture", overview.system.architecture],
                ["Numéro de série", overview.system.serial],
                ["Mémoire installée", formatBytes(overview.system.memoryBytes)],
              ].map(([label, value]) => (
                <div key={label} className="bg-secondary/45 rounded-xl p-4">
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="mt-2 font-medium break-all">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Aucune information système disponible.
            </p>
          )}
        </Panel>
        <Panel>
          <PanelHeader
            title="Disponibilité"
            subtitle="État courant du NAS"
            icon={<Clock3 className="size-4" />}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="bg-secondary/45 rounded-xl p-4">
              <p className="text-muted-foreground text-xs">Uptime</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatUptime(overview.system?.uptimeSeconds)}
              </p>
            </div>
            <div className="bg-secondary/45 rounded-xl p-4">
              <p className="text-muted-foreground text-xs">Température système</p>
              <p className="mt-2 text-2xl font-semibold">
                {overview.system?.temperatureCelsius === undefined
                  ? "—"
                  : `${overview.system.temperatureCelsius} °C`}
              </p>
            </div>
            <div className="bg-secondary/45 rounded-xl p-4">
              <p className="text-muted-foreground text-xs">Réseau entrant / sortant</p>
              <p className="mt-2 font-medium">
                {formatBytes(overview.utilization?.networkReceiveBytesPerSecond)}/s ·{" "}
                {formatBytes(overview.utilization?.networkTransmitBytesPerSecond)}/s
              </p>
            </div>
          </div>
        </Panel>
      </section>

      {overview.volumes.length > 0 ? (
        <section>
          <div className="mb-4 flex items-center gap-3">
            <Database className="text-primary size-5" />
            <div>
              <h2 className="font-semibold">Volumes</h2>
              <p className="text-muted-foreground text-xs">Capacité et occupation DSM</p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {overview.volumes.map((volume) => (
              <VolumeCard key={volume.id} volume={volume} />
            ))}
          </div>
        </section>
      ) : null}

      {overview.storagePools.length > 0 ? (
        <section>
          <div className="mb-4 flex items-center gap-3">
            <Layers3 className="text-primary size-5" />
            <div>
              <h2 className="font-semibold">Groupes de stockage</h2>
              <p className="text-muted-foreground text-xs">RAID et capacité agrégée</p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {overview.storagePools.map((pool) => (
              <PoolCard key={pool.id} pool={pool} />
            ))}
          </div>
        </section>
      ) : null}

      <Panel>
        <PanelHeader
          title="Disques"
          subtitle={`${overview.disks.length} disque${overview.disks.length > 1 ? "s" : ""} retourné${overview.disks.length > 1 ? "s" : ""} par DSM`}
          icon={<HardDrive className="size-4" />}
        />
        {overview.disks.length > 0 ? (
          <ul>
            {overview.disks.map((disk) => (
              <DiskRow key={disk.id} disk={disk} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground py-10 text-center text-sm">
            Aucun détail de disque disponible avec les permissions actuelles.
          </p>
        )}
      </Panel>

      {overview.capabilities.length > 0 ? (
        <Panel>
          <PanelHeader
            title="API DSM découvertes"
            subtitle="Catalogue fermé utilisé par VestyHub"
            icon={<Network className="size-4" />}
          />
          <div className="flex flex-wrap gap-2">
            {overview.capabilities.map((capability) => (
              <Badge key={capability.api} variant="outline">
                {capability.api} v{capability.minVersion}–{capability.maxVersion}
              </Badge>
            ))}
          </div>
        </Panel>
      ) : null}

      {overview.warnings.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Informations partielles"
            subtitle="La page reste disponible malgré les capacités DSM absentes."
            icon={<TriangleAlert className="size-4" />}
          />
          <ul className="space-y-2">
            {overview.warnings.map((warning, index) => (
              <li
                key={`${warning.code}:${warning.api ?? "global"}:${index}`}
                className="bg-warning/8 text-muted-foreground rounded-xl px-3 py-2 text-sm"
              >
                <strong className="text-foreground">{warning.api ?? warning.code}</strong>{" "}
                — {warning.message}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {overview.status.errorCode ? (
        <p className="text-destructive text-sm">
          {publicSynologyErrorMessage(overview.status.errorCode)}
        </p>
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
