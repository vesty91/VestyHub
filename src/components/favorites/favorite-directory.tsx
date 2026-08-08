"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { FavoriteCard } from "@/components/favorites/favorite-card";
import { GridStackFavorites } from "@/components/favorites/gridstack-favorites";
import { Input } from "@/components/ui/input";
import type { Favorite } from "@/db/schema";

export interface FavoriteDirectoryItem extends Favorite {
  groupName: string | null;
}

export function FavoriteDirectory({
  items,
  canEdit,
}: {
  items: FavoriteDirectoryItem[];
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const groups = useMemo(
    () => [...new Set(items.map((item) => item.groupName).filter(Boolean))] as string[],
    [items],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    const tags = Array.isArray(item.tags) ? item.tags.join(" ") : "";
    const haystack = `${item.name} ${item.description ?? ""} ${tags}`.toLowerCase();
    return (
      haystack.includes(normalizedQuery) && (group === "all" || item.groupName === group)
    );
  });
  const layoutMode = normalizedQuery.length === 0 && group === "all";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un favori ou un tag…"
            className="pl-9"
          />
        </div>
        <select
          value={group}
          onChange={(event) => setGroup(event.target.value)}
          className="border-border bg-background text-foreground focus:border-primary/50 focus:ring-ring/30 h-10 rounded-xl border px-3 text-sm transition outline-none focus:ring-2"
        >
          <option className="bg-popover text-popover-foreground" value="all">
            Tous les groupes
          </option>
          {groups.map((groupName) => (
            <option
              key={groupName}
              value={groupName}
              className="bg-popover text-popover-foreground"
            >
              {groupName}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="border-border grid min-h-64 place-items-center rounded-2xl border border-dashed text-center">
          <div>
            <Search className="text-muted-foreground mx-auto mb-3 size-7" />
            <p className="font-medium">Aucun favori trouvé</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Modifie la recherche ou ajoute un service.
            </p>
          </div>
        </div>
      ) : layoutMode ? (
        <GridStackFavorites items={items} canEdit={canEdit}>
          {items.map((item) => (
            <FavoriteCard
              key={item.id}
              item={item}
              canEdit={canEdit}
              reserveDragHandleSpace={canEdit}
            />
          ))}
        </GridStackFavorites>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((item) => (
            <FavoriteCard key={item.id} item={item} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}
