"use client";

import { useActionState } from "react";
import { FolderPlus } from "lucide-react";

import { createGroupAction } from "@/app/(dashboard)/favorites/actions";
import { initialFavoriteActionState } from "@/app/(dashboard)/favorites/state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GroupForm() {
  const [state, formAction, pending] = useActionState(
    createGroupAction,
    initialFavoriteActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <Input name="name" placeholder="Nouveau groupe" required maxLength={60} />
      <input type="hidden" name="description" value="" />
      <input type="hidden" name="icon" value="server" />
      <Button type="submit" variant="outline" disabled={pending} className="shrink-0">
        <FolderPlus className="size-4" />
        {pending ? "Création…" : "Créer le groupe"}
      </Button>
      {state.status === "error" ? (
        <p className="self-center text-xs text-red-300">{state.message}</p>
      ) : null}
      {state.status === "idle" && state.message ? (
        <p className="self-center text-xs text-emerald-300">{state.message}</p>
      ) : null}
    </form>
  );
}
