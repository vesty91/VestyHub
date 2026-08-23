"use client";

import { ArrowUpRight, Star } from "lucide-react";
import Link from "next/link";

import { ServiceIcon } from "@/components/icons/service-icon";
import { useFavoriteHealth } from "@/components/favorites/use-favorite-health";
import type { Favorite } from "@/db/schema";
import type { FavoritesWidgetConfiguration } from "@/lib/dashboard/widget-catalog";
import { cn } from "@/lib/utils";

export function FavoritesWidget({
  favorites,
  configuration,
}: {
  favorites: Favorite[];
  configuration: FavoritesWidgetConfiguration;
}) {
  const displayedFavorites = favorites.slice(0, configuration.limit);
  const healthEnabledIds = displayedFavorites
    .filter((favorite) => favorite.healthCheckEnabled)
    .map((favorite) => favorite.id);
  const { healthById } = useFavoriteHealth(healthEnabledIds);

  return (
    <div className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
      <div className="mb-4 flex items-center justify-between pr-10">
        <div>
          <p className="text-sm font-medium">Accès rapides</p>
          <p className="text-xs text-zinc-500">Services épinglés</p>
        </div>
        <Link
          href="/favorites"
          className="text-xs text-cyan-300 transition hover:text-cyan-200"
        >
          Gérer
        </Link>
      </div>

      {favorites.length === 0 ? (
        <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-white/10 text-center">
          <div>
            <Star className="mx-auto mb-2 size-5 text-zinc-600" />
            <p className="text-sm text-zinc-500">Aucun favori épinglé</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {displayedFavorites.map((favorite) => {
            const url = favorite.internalUrl || favorite.externalUrl;
            const health = healthById[favorite.id];
            const content = (
              <>
                <div className="grid size-9 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300">
                  <ServiceIcon name={favorite.iconValue} className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{favorite.name}</p>
                  <div className="flex items-center gap-1.5">
                    {favorite.healthCheckEnabled ? (
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          !health && "bg-muted-foreground animate-pulse",
                          health?.status === "online" && "bg-success",
                          health?.status === "degraded" && "bg-warning",
                          health?.status === "offline" && "bg-destructive",
                        )}
                        aria-label={health?.status ?? "checking"}
                      />
                    ) : null}
                    <p className="truncate text-[11px] text-zinc-500">
                      {favorite.description || "Service homelab"}
                    </p>
                  </div>
                </div>
                {url ? <ArrowUpRight className="size-3.5 text-zinc-600" /> : null}
              </>
            );

            return url ? (
              <a
                key={favorite.id}
                href={url}
                target={favorite.openMode === "new_tab" ? "_blank" : undefined}
                rel={favorite.openMode === "new_tab" ? "noreferrer" : undefined}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.06] bg-black/10 p-3 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.04]"
              >
                {content}
              </a>
            ) : (
              <div
                key={favorite.id}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.06] bg-black/10 p-3 opacity-65"
                title="URL à configurer"
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
