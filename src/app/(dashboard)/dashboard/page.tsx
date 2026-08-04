import Link from "next/link";
import { Activity, Container, LayoutGrid, Plus, ShieldCheck, Star } from "lucide-react";
import { and, count, desc, eq } from "drizzle-orm";

import { ClockWidget } from "@/components/dashboard/clock-widget";
import { FavoritesWidget } from "@/components/dashboard/favorites-widget";
import { StatusWidget } from "@/components/dashboard/status-widget";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
        .select()
        .from(favorites)
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

  return (
    <div className="mx-auto max-w-[1600px] space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge className="border-cyan-300/15 bg-cyan-300/10 text-cyan-200">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Phase 2
            </Badge>
            <span className="text-xs text-zinc-600">Vue instantanée</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Bonjour, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Voici l’état actuel de ton environnement homelab.
          </p>
        </div>
        <Link
          href="/favorites/new"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
        >
          <Plus className="size-4" />
          Ajouter un favori
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Favoris",
            value: favoriteCount,
            detail: `${groupCount} groupe${groupCount > 1 ? "s" : ""}`,
            icon: Star,
          },
          {
            label: "Conteneurs Docker",
            value: docker.available ? (docker.engine?.containers ?? 0) : "—",
            detail: docker.available
              ? `${docker.engine?.running ?? 0} en cours`
              : "Proxy indisponible",
            icon: Container,
          },
          {
            label: "Widgets",
            value: widgets.length,
            detail: dashboard?.name ?? "Dashboard à initialiser",
            icon: LayoutGrid,
          },
          {
            label: "Sécurité",
            value: "Active",
            detail: "Session + RBAC",
            icon: ShieldCheck,
          },
        ].map((stat) => (
          <Card key={stat.label} className="overflow-hidden">
            <CardContent className="relative">
              <div className="absolute top-4 right-4 grid size-9 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300">
                <stat.icon className="size-4" />
              </div>
              <p className="text-xs tracking-[0.16em] text-zinc-600 uppercase">
                {stat.label}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{stat.value}</p>
              <p className="mt-1 text-xs text-zinc-500">{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid auto-rows-[minmax(150px,auto)] grid-cols-1 gap-4 xl:grid-cols-6">
        {widgets.length === 0 ? (
          <Card className="xl:col-span-6">
            <CardContent className="grid min-h-52 place-items-center text-center">
              <div>
                <LayoutGrid className="mx-auto mb-3 size-7 text-zinc-600" />
                <p className="font-medium">Aucun widget enregistré</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Lance le seed pour créer la disposition initiale.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          widgets.map((widget) => {
            const span = Math.max(1, Math.min(6, widget.width));
            const className =
              span >= 4 ? "xl:col-span-4" : span >= 2 ? "xl:col-span-2" : "xl:col-span-1";

            return (
              <div key={widget.id} className={className}>
                {widget.widgetType === "clock" ? <ClockWidget /> : null}
                {widget.widgetType === "favorites" ? (
                  <FavoritesWidget favorites={pinnedFavorites} />
                ) : null}
                {widget.widgetType === "system-status" ? (
                  <StatusWidget docker={docker} databaseReady />
                ) : null}
                {!["clock", "favorites", "system-status"].includes(widget.widgetType) ? (
                  <Card className="h-full">
                    <CardContent>
                      <p className="text-sm font-medium">{widget.title}</p>
                      <p className="mt-2 text-xs text-zinc-500">
                        Widget non enregistré dans cette version.
                      </p>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            );
          })
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardContent>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="font-medium">Docker</p>
                <p className="text-xs text-zinc-500">Synthèse en lecture seule</p>
              </div>
              <Link href="/docker" className="text-xs text-cyan-300 hover:text-cyan-200">
                Voir les détails
              </Link>
            </div>
            {docker.available && docker.engine ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Actifs",
                    value: docker.engine.running,
                    color: "text-emerald-300",
                  },
                  {
                    label: "Arrêtés",
                    value: docker.engine.stopped,
                    color: "text-zinc-300",
                  },
                  {
                    label: "Images",
                    value: docker.engine.images,
                    color: "text-cyan-300",
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-black/15 p-4">
                    <p className="text-xs text-zinc-600">{item.label}</p>
                    <p className={`mt-2 text-2xl font-semibold ${item.color}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
                {docker.error}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="mb-5 flex items-center gap-2">
              <Activity className="size-4 text-cyan-300" />
              <div>
                <p className="font-medium">Activité récente</p>
                <p className="text-xs text-zinc-500">Journal d’audit personnel</p>
              </div>
            </div>
            <div className="space-y-3">
              {recentEvents.length ? (
                recentEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <span className="mt-1.5 size-1.5 rounded-full bg-cyan-300" />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{event.action}</p>
                      <p className="text-[11px] text-zinc-600">
                        {event.resourceType} · {event.createdAt.toLocaleString("fr-FR")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-500">Aucun événement récent.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
