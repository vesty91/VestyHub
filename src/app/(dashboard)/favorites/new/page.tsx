import { asc, eq } from "drizzle-orm";

import { createFavoriteAction } from "@/app/(dashboard)/favorites/actions";
import { FavoriteForm } from "@/components/favorites/favorite-form";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { favoriteGroups } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";

export default async function NewFavoritePage() {
  const user = await requireRole("USER");
  const groups = await db
    .select()
    .from(favoriteGroups)
    .where(eq(favoriteGroups.userId, user.id))
    .orderBy(asc(favoriteGroups.sortOrder), asc(favoriteGroups.name));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-cyan-300">Nouveau service</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Ajouter un favori</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Les URL privées sont acceptées pour les services du homelab.
        </p>
      </header>
      <Card>
        <CardContent>
          <FavoriteForm
            action={createFavoriteAction}
            groups={groups}
            submitLabel="Créer le favori"
          />
        </CardContent>
      </Card>
    </div>
  );
}
