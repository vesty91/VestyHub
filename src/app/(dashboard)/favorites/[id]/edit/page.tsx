import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";

import { updateFavoriteAction } from "@/app/(dashboard)/favorites/actions";
import { FavoriteForm } from "@/components/favorites/favorite-form";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { favoriteGroups, favorites } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";

export default async function EditFavoritePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("USER");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    notFound();
  }

  const [[favorite], groups] = await Promise.all([
    db
      .select()
      .from(favorites)
      .where(and(eq(favorites.id, id), eq(favorites.userId, user.id)))
      .limit(1),
    db
      .select()
      .from(favoriteGroups)
      .where(eq(favoriteGroups.userId, user.id))
      .orderBy(asc(favoriteGroups.sortOrder), asc(favoriteGroups.name)),
  ]);

  if (!favorite) {
    notFound();
  }

  const action = updateFavoriteAction.bind(null, favorite.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-cyan-300">Configuration du service</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Modifier {favorite.name}
        </h1>
      </header>
      <Card>
        <CardContent>
          <FavoriteForm
            action={action}
            groups={groups}
            favorite={favorite}
            submitLabel="Enregistrer les modifications"
          />
        </CardContent>
      </Card>
    </div>
  );
}
