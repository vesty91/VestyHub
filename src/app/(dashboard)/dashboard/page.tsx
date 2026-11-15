import { and, count, desc, eq } from "drizzle-orm";
import { Activity, Container, LayoutGrid, Plus, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";

import { ClockWidget } from "@/components/dashboard/clock-widget";
import { DashboardApplications } from "@/components/dashboard/dashboard-applications";
import { FavoritesWidget } from "@/components/dashboard/favorites-widget";
import { GridStackDashboard } from "@/components/dashboard/gridstack-dashboard";
import { LocalHealthWidget } from "@/components/dashboard/local-health-widget";
import { MonitoringWidget } from "@/components/dashboard/monitoring-widget";
import { StatusWidget } from "@/components/dashboard/status-widget";
import { Badge } from "@/components/ui/badge";
import {
  PageHeader,
  Panel,
  PanelHeader,
  StatCard,
  StatusDot,
} from "@/components/vestyhub/primitives";
import { getDockerOverview } from "@/connectors/docker/client";
import { db } from "@/db";
import {
  auditLogs,
  dashboardWidgets,
  dashboards,
  favoriteGroups,
  favorites,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { resolveDashboardWidgetConfiguration } from "@/lib/dashboard/widget-catalog";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  const [dashboard] = await db
    .select()
    .from(dashboards)
    .where(eq(dashboards.userId, user.id))
    .orderBy(desc(dashboards.isDefault), dashboards.createdAt)
    .limit(1);

  const [widgets, pinnedFavorites, favoriteStats, groupStats, recentEvents, docker] =
    await Promise.all([
      dashboard
        ? db
            .select()
            .from(dashboardWidgets)
            .where(eq(dashboardWidgets.dashboardId, dashboard.id))
            .orderBy(dashboardWidgets.positionY, dashboardWidgets.positionX)
        : Promise.resolve([]),
      db
        .select({
          id: favorites.id,
          userId: favorites.userId,
          groupId: favorites.groupId,
          name: favorites.name,
          description: favorites.description,
          internalUrl: favorites.internalUrl,
          externalUrl: favorites.externalUrl,
          iconType: favorites.iconType,
          iconValue: favorites.iconValue,
          tags: favorites.tags,
          openMode: favorites.openMode,
          healthCheckEnabled: favorites.healthCheckEnabled,
          healthCheckUrl: favorites.healthCheckUrl,
          dockerContainerId: favorites.dockerContainerId,
          connectorId: favorites.connectorId,
          sortOrder: favorites.sortOrder,
          isFavorite: favorites.isFavorite,
          positionX: favorites.positionX,
          positionY: favorites.positionY,
          width: favorites.width,
          height: favorites.height,
          createdAt: favorites.createdAt,
          updatedAt: favorites.updatedAt,
          groupName: favoriteGroups.name,
        })
        .from(favorites)
        .leftJoin(favoriteGroups, eq(favorites.groupId, favoriteGroups.id))
        .where(and(eq(favorites.userId, user.id), eq(favorites.isFavorite, true)))
        .orderBy(favorites.sortOrder)
        .limit(8),
      db.select({ value: count() }).from(favorites).where(eq(favorites.userId, user.id)),
      db
        .select({ value: count() })
        .from(favoriteGroups)
        .where(eq(favoriteGroups.userId, user.id)),
      db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          resourceType: auditLogs.resourceType,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .where(eq(auditLogs.userId, user.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(5),
      getDockerOverview(),
    ]);

  const favoriteCount = Number(favoriteStats[0]?.value ?? 0);
  const groupCount = Number(groupStats[0]?.value ?? 0);
  const visibleWidgets = widgets.filter((widget) => widget.isVisible);

  const stats = [
    {
      label: "Favoris",
      value: favoriteCount,
      detail: `${groupCount} groupe${groupCount > 1 ? "s" : ""}`,
      icon: <Star className="size-4" />,
      tone: "primary" as const,
    },
    {
      label: "Conteneurs Docker",
      value: docker.available ? docker.counters.total : "—",
      detail: docker.available
        ? `${docker.counters.running} en cours`
        : "Proxy indisponible",
      icon: <Container className="size-4" />,
      tone: docker.available ? ("success" as const) : ("warning" as const),
    },
    {
      label: "Widgets",
      value: visibleWidgets.length,
      detail: `${widgets.length} enregistré${widgets.length > 1 ? "s" : ""}`,
      icon: <LayoutGrid className="size-4" />,
      tone: "info" as const,
    },
    {
      label: "Sécurité",
      value: "Active",
      detail: "Session + RBAC",
      icon: <ShieldCheck className="size-4" />,
      tone: "success" as const,
    },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-7">
      <PageHeader
        title={`Bonjour, ${user.name.split(" ")[0]}`}
        description="Voici l’état actuel de ton environnement homelab, alimenté par PostgreSQL et les connecteurs réels du NAS."
        eyebrow={
          <>
            <Badge className="border-primary/20 bg-primary/10 text-primary">
              <span className="bg-success size-1.5 rounded-full" />
              Phase 3K · v0.3.0
            </Badge>
            <span className="text-muted-foreground text-xs">
              Dashboard personnalisable
            </span>
          </>
        }
        actions={
          <Link
            href="/favorites/new"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition"
          >
            <Plus className="size-4" />
            Ajouter une application
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Résumé">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="space-y-3" aria-labelledby="applications-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="applications-title" className="text-lg font-semibold">
              Applications
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Tes services épinglés, disponibles directement depuis le dashboard.
            </p>
          </div>
          <Link href="/favorites" className="text-primary text-sm hover:underline">
            Gérer les applications
          </Link>
        </div>
        <DashboardApplications
          items={pinnedFavorites}
          canEdit={user.role === "ADMIN" || user.role === "USER"}
        />
      </section>

      <section aria-label="Widgets personnalisables">
        {!dashboard ? (
          <Panel contentClassName="grid min-h-52 place-items-center text-center">
            <div>
              <LayoutGrid className="text-muted-foreground mx-auto mb-3 size-7" />
              <p className="font-medium">Aucun dashboard enregistré</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Lance le seed pour créer le dashboard initial.
              </p>
            </div>
          </Panel>
        ) : (
          <GridStackDashboard
            dashboardId={dashboard.id}
            widgetStates={widgets.map((widget) => ({
              type: widget.widgetType,
              isVisible: widget.isVisible,
              configuration: widget.configuration,
            }))}
            widgets={visibleWidgets.map((widget) => {
              const contentMinHeight = [
                "favorites",
                "system-status",
                "local-health",
                "monitoring",
              ].includes(widget.widgetType)
                ? 2
                : 1;
              const minHeight = Math.max(widget.minHeight, contentMinHeight);

              return {
                id: widget.id,
                widgetType: widget.widgetType,
                title: widget.title,
                positionX: widget.positionX,
                positionY: widget.positionY,
                width: widget.width,
                height: Math.max(widget.height, minHeight),
                minWidth: widget.minWidth,
                minHeight,
              };
            })}
          >
            {visibleWidgets.map((widget) => (
              <div key={widget.id} className="h-full">
                {widget.widgetType === "clock" ? (
                  <ClockWidget
                    configuration={resolveDashboardWidgetConfiguration(
                      "clock",
                      widget.configuration,
                    )}
                  />
                ) : null}
                {widget.widgetType === "favorites" ? (
                  <FavoritesWidget
                    favorites={pinnedFavorites}
                    configuration={resolveDashboardWidgetConfiguration(
                      "favorites",
                      widget.configuration,
                    )}
                  />
                ) : null}
                {widget.widgetType === "system-status" ? (
                  <StatusWidget
                    docker={docker}
                    databaseReady
                    configuration={resolveDashboardWidgetConfiguration(
                      "system-status",
                      widget.configuration,
                    )}
                  />
                ) : null}
                {widget.widgetType === "local-health" ? (
                  <LocalHealthWidget
                    configuration={resolveDashboardWidgetConfiguration(
                      "local-health",
                      widget.configuration,
                    )}
                  />
                ) : null}
                {widget.widgetType === "monitoring" ? (
                  <MonitoringWidget
                    configuration={resolveDashboardWidgetConfiguration(
                      "monitoring",
                      widget.configuration,
                    )}
                  />
                ) : null}
                {!["clock", "favorites", "system-status", "monitoring"].includes(
                  widget.widgetType,
                ) ? (
                  <Panel className="h-full">
                    <p className="text-sm font-medium">{widget.title}</p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      Widget non enregistré dans cette version.
                    </p>
                  </Panel>
                ) : null}
              </div>
            ))}
          </GridStackDashboard>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel>
          <PanelHeader
            title="Docker"
            subtitle="Synthèse du moteur NAS en lecture seule"
            icon={<Container className="size-4" />}
            action={
              <Link href="/docker" className="text-primary hover:text-primary/80 text-xs">
                Voir les détails
              </Link>
            }
          />

          {docker.available && docker.engine ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="bg-surface-elevated/65 rounded-xl p-4">
                <StatusDot
                  tone="success"
                  label="Actifs"
                  pulse={docker.counters.running > 0}
                />
                <p className="text-success mt-3 text-2xl font-semibold">
                  {docker.counters.running}
                </p>
              </div>
              <div className="bg-surface-elevated/65 rounded-xl p-4">
                <StatusDot tone="neutral" label="Arrêtés" />
                <p className="mt-3 text-2xl font-semibold">{docker.counters.stopped}</p>
              </div>
              <div className="bg-surface-elevated/65 rounded-xl p-4">
                <StatusDot tone="info" label="Images" />
                <p className="text-info mt-3 text-2xl font-semibold">
                  {docker.engine.images}
                </p>
              </div>
            </div>
          ) : (
            <div className="border-warning/20 bg-warning/[0.06] rounded-xl border p-4">
              <StatusDot tone="warning" label="Docker indisponible" />
              <p className="text-muted-foreground mt-2 text-sm">{docker.error}</p>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Activité récente"
            subtitle="Journal d’audit personnel"
            icon={<Activity className="size-4" />}
          />
          <div className="space-y-3">
            {recentEvents.length ? (
              recentEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3">
                  <span className="bg-primary mt-1.5 size-1.5 rounded-full" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{event.action}</p>
                    <p className="text-muted-foreground text-[11px]">
                      {event.resourceType} · {event.createdAt.toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">Aucun événement récent.</p>
            )}
          </div>
        </Panel>
      </section>
    </div>
  );
}
