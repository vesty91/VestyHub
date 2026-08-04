"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, ExternalLink, Pencil, Pin, Search, Trash2 } from "lucide-react";

import {
  deleteFavoriteAction,
  toggleFavoriteAction,
} from "@/app/(dashboard)/favorites/actions";
import { ServiceIcon } from "@/components/icons/service-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Favorite } from "@/db/schema";
import { cn } from "@/lib/utils";

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
  const filtered = items.filter((item) => {
    const tags = Array.isArray(item.tags) ? item.tags.join(" ") : "";
    const haystack = `${item.name} ${item.description ?? ""} ${tags}`.toLowerCase();
    return (
      haystack.includes(query.toLowerCase()) &&
      (group === "all" || item.groupName === group)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-600" />
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
          className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-cyan-400/50"
        >
          <option value="all">Tous les groupes</option>
          {groups.map((groupName) => (
            <option key={groupName} value={groupName}>
              {groupName}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-white/10 text-center">
          <div>
            <Search className="mx-auto mb-3 size-7 text-zinc-600" />
            <p className="font-medium">Aucun favori trouvé</p>
            <p className="mt-1 text-sm text-zinc-500">
              Modifie la recherche ou ajoute un service.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((item) => {
            const primaryUrl = item.internalUrl || item.externalUrl;
            const tags = Array.isArray(item.tags)
              ? item.tags.filter((tag): tag is string => typeof tag === "string")
              : [];

            return (
              <article
                key={item.id}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-cyan-300/[0.035]"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="grid size-11 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-300 ring-1 ring-cyan-300/15">
                    <ServiceIcon name={item.iconValue} className="size-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit ? (
                      <form action={toggleFavoriteAction}>
                        <input type="hidden" name="favoriteId" value={item.id} />
                        <input
                          type="hidden"
                          name="nextValue"
                          value={String(!item.isFavorite)}
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={item.isFavorite ? "Désépingler" : "Épingler"}
                          className={cn(item.isFavorite && "text-cyan-300")}
                        >
                          <Pin className="size-3.5" />
                        </Button>
                      </form>
                    ) : null}
                    {canEdit ? (
                      <Button
                        asChild
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Modifier"
                      >
                        <Link href={`/favorites/${item.id}/edit`}>
                          <Pencil className="size-3.5" />
                        </Link>
                      </Button>
                    ) : null}
                    {canEdit ? (
                      <form
                        action={deleteFavoriteAction}
                        onSubmit={(event) => {
                          if (!window.confirm(`Supprimer ${item.name} ?`)) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="favoriteId" value={item.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Supprimer"
                          className="text-zinc-600 hover:text-red-300"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold">{item.name}</h2>
                    {item.groupName ? <Badge>{item.groupName}</Badge> : null}
                  </div>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-zinc-500">
                    {item.description || "Service homelab sans description."}
                  </p>
                </div>

                {tags.length ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white/[0.045] px-2 py-1 text-[10px] text-zinc-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-5 flex items-center gap-2 border-t border-white/[0.06] pt-4">
                  {item.internalUrl ? (
                    <a
                      href={item.internalUrl}
                      target={item.openMode === "new_tab" ? "_blank" : undefined}
                      rel={item.openMode === "new_tab" ? "noreferrer" : undefined}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-cyan-200"
                    >
                      Ouvrir LAN <ArrowUpRight className="size-3.5" />
                    </a>
                  ) : null}
                  {item.externalUrl ? (
                    <a
                      href={item.externalUrl}
                      target={item.openMode === "new_tab" ? "_blank" : undefined}
                      rel={item.openMode === "new_tab" ? "noreferrer" : undefined}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-white/[0.05]"
                    >
                      WAN <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                  {!primaryUrl ? (
                    <span className="w-full rounded-xl border border-dashed border-white/10 py-2 text-center text-xs text-zinc-600">
                      URL à configurer
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
