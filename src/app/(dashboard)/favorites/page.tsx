import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { asc, eq } from "drizzle-orm";

import { FavoriteDirectory } from "@/components/favorites/favorite-directory";
import { GroupForm } from "@/components/favorites/group-form";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { favoriteGroups, favorites } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await requireUser();
  const [groups, items] = await Promise.all([
    db
      .select()
      .from(favoriteGroups)
      .where(eq(favoriteGroups.userId, user.id))
      .orderBy(asc(favoriteGroups.sortOrder), asc(favoriteGroups.name)),
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
      .where(eq(favorites.userId, user.id))
      .orderBy(asc(favorites.sortOrder), asc(favorites.name)),
  ]);

  const canEdit = user.role === "ADMIN" || user.role === "USER";

  return (
    <div className="mx-auto max-w-[1600px] space-y-7">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge>
              <Star className="size-3" />
              {items.length} service{items.length > 1 ? "s" : ""}
            </Badge>
            <span className="text-xs text-zinc-600">
              {groups.length} groupe{groups.length > 1 ? "s" : ""}
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Centralise les interfaces de ton NAS, tes conteneurs et tes outils.
          </p>
        </div>
        {canEdit ? (
          <Link
            href="/favorites/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
          >
            <Plus className="size-4" />
            Ajouter une application
          </Link>
        ) : null}
      </header>

      {canEdit ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
          <p className="mb-3 text-xs tracking-[0.14em] text-zinc-600 uppercase">
            Organisation
          </p>
          <GroupForm />
        </div>
      ) : null}

      <FavoriteDirectory items={items} canEdit={canEdit} />
    </div>
  );
}
