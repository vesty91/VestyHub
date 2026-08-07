"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Save } from "lucide-react";

import type { FavoriteActionState } from "@/app/(dashboard)/favorites/state";
import { initialFavoriteActionState } from "@/app/(dashboard)/favorites/state";
import { IconPicker } from "@/components/icons/icon-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Favorite, FavoriteGroup } from "@/db/schema";

type FavoriteFormAction = (
  state: FavoriteActionState,
  formData: FormData,
) => Promise<FavoriteActionState>;

export function FavoriteForm({
  action,
  groups,
  favorite,
  submitLabel,
}: {
  action: FavoriteFormAction;
  groups: FavoriteGroup[];
  favorite?: Favorite;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFavoriteActionState);
  const tags = Array.isArray(favorite?.tags)
    ? favorite.tags.filter((tag): tag is string => typeof tag === "string").join(", ")
    : "";

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="name">Nom du service</Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={80}
            defaultValue={favorite?.name ?? ""}
            placeholder="Grafana"
            aria-describedby={state.fieldErrors?.name ? "name-error" : undefined}
          />
          {state.fieldErrors?.name ? (
            <p id="name-error" className="text-xs text-red-300">
              {state.fieldErrors.name[0]}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            maxLength={300}
            defaultValue={favorite?.description ?? ""}
            placeholder="Supervision de l’infrastructure"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="internalUrl">URL interne</Label>
          <Input
            id="internalUrl"
            name="internalUrl"
            type="url"
            defaultValue={favorite?.internalUrl ?? ""}
            placeholder="https://grafana.local"
          />
          {state.fieldErrors?.internalUrl ? (
            <p className="text-xs text-red-300">{state.fieldErrors.internalUrl[0]}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="externalUrl">URL externe</Label>
          <Input
            id="externalUrl"
            name="externalUrl"
            type="url"
            defaultValue={favorite?.externalUrl ?? ""}
            placeholder="https://grafana.example.com"
          />
          {state.fieldErrors?.externalUrl ? (
            <p className="text-xs text-red-300">{state.fieldErrors.externalUrl[0]}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="groupId">Groupe</Label>
          <select
            id="groupId"
            name="groupId"
            defaultValue={favorite?.groupId ?? ""}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          >
            <option value="" className="bg-popover text-popover-foreground">
              Sans groupe
            </option>
            {groups.map((group) => (
              <option
                key={group.id}
                value={group.id}
                className="bg-popover text-popover-foreground"
              >
                {group.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label id="iconValue-label" htmlFor="iconValue-trigger">
            Icône du service
          </Label>
          <IconPicker
            name="iconValue"
            defaultValue={favorite?.iconValue}
            labelId="iconValue-label"
          />
          <p className="text-xs text-zinc-500">
            Recherche parmi les catégories Docker, téléchargements, NAS, réseau, sécurité,
            multimédia et outils.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="openMode">Ouverture</Label>
          <select
            id="openMode"
            name="openMode"
            defaultValue={favorite?.openMode ?? "new_tab"}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          >
            <option value="new_tab" className="bg-popover text-popover-foreground">
              Nouvel onglet
            </option>
            <option value="same_tab" className="bg-popover text-popover-foreground">
              Même onglet
            </option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            name="tags"
            defaultValue={tags}
            placeholder="monitoring, docker, réseau"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="healthCheckUrl">URL de contrôle de santé</Label>
          <Input
            id="healthCheckUrl"
            name="healthCheckUrl"
            type="url"
            defaultValue={favorite?.healthCheckUrl ?? ""}
            placeholder="https://grafana.local/api/health"
          />
          {state.fieldErrors?.healthCheckUrl ? (
            <p className="text-xs text-red-300">{state.fieldErrors.healthCheckUrl[0]}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-5 rounded-2xl border border-white/[0.07] bg-black/15 p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            name="isFavorite"
            defaultChecked={favorite?.isFavorite ?? true}
            className="size-4 accent-cyan-300"
          />
          Épingler sur le dashboard
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            name="healthCheckEnabled"
            defaultChecked={favorite?.healthCheckEnabled ?? false}
            className="size-4 accent-cyan-300"
          />
          Activer le contrôle de santé
        </label>
      </div>

      {state.status === "error" ? (
        <div
          role="alert"
          className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"
        >
          {state.message}
        </div>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button asChild type="button" variant="outline" size="lg">
          <Link href="/favorites">Annuler</Link>
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="bg-cyan-300 text-zinc-950 hover:bg-cyan-200"
        >
          <Save className="size-4" />
          {pending ? "Enregistrement…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
