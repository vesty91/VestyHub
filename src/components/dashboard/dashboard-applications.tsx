"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";

import { FavoriteCard } from "@/components/favorites/favorite-card";
import type { FavoriteDirectoryItem } from "@/components/favorites/favorite-directory";
import { GridStackFavorites } from "@/components/favorites/gridstack-favorites";
import { useFavoriteHealth } from "@/components/favorites/use-favorite-health";

export function DashboardApplications({
  items,
  canEdit,
}: {
  items: FavoriteDirectoryItem[];
  canEdit: boolean;
}) {
  const healthEnabledIds = items
    .filter((item) => item.healthCheckEnabled)
    .map((item) => item.id);
  const { healthById, isRefreshing } = useFavoriteHealth(healthEnabledIds);

  if (items.length === 0) {
    return (
      <div className="border-border grid min-h-44 place-items-center rounded-2xl border border-dashed text-center">
        <div>
          <Search className="text-muted-foreground mx-auto mb-3 size-7" />
          <p className="font-medium">Aucune application épinglée</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Ajoute un service pour le faire apparaître ici.
          </p>
          {canEdit ? (
            <Link
              href="/favorites/new"
              className="bg-primary text-primary-foreground mt-4 inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold"
            >
              <Plus className="size-4" />
              Ajouter une application
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground flex min-h-5 items-center justify-between text-xs">
        <span>
          {items.length} application{items.length > 1 ? "s" : ""}
        </span>
        {healthEnabledIds.length ? (
          <span aria-live="polite">
            {isRefreshing
              ? "Vérification des services…"
              : "État actualisé automatiquement"}
          </span>
        ) : null}
      </div>
      <GridStackFavorites items={items} canEdit={canEdit}>
        {items.map((item) => (
          <FavoriteCard
            key={item.id}
            item={item}
            canEdit={canEdit}
            reserveDragHandleSpace={canEdit}
            health={healthById[item.id]}
          />
        ))}
      </GridStackFavorites>
    </div>
  );
}
