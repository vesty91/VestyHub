import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { favorites } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";
import { favoritesLayoutPayloadSchema } from "@/lib/favorites/layout";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;

export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const parsed = favoritesLayoutPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Disposition invalide.", issues: parsed.error.flatten() },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const { items } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      if (items.length === 0) {
        return;
      }

      const itemIds = items.map((item) => item.id);
      const ownedItems = await tx
        .select({ id: favorites.id })
        .from(favorites)
        .where(
          and(eq(favorites.userId, session.user.id), inArray(favorites.id, itemIds)),
        );

      if (ownedItems.length !== items.length) {
        throw new LayoutAccessError();
      }

      const updatedAt = new Date();
      for (const item of items) {
        await tx
          .update(favorites)
          .set({
            positionX: item.x,
            positionY: item.y,
            width: item.width,
            height: item.height,
            updatedAt,
          })
          .where(and(eq(favorites.id, item.id), eq(favorites.userId, session.user.id)));
      }
    });
  } catch (error) {
    if (error instanceof LayoutAccessError) {
      return NextResponse.json(
        { error: "Un ou plusieurs favoris sont introuvables." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
    throw error;
  }

  return NextResponse.json(
    { version: 1, saved: items.length },
    { headers: NO_STORE_HEADERS },
  );
}

class LayoutAccessError extends Error {}
