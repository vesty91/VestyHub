"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { favoriteGroups, favorites } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/dal";
import { getRequestContext } from "@/lib/auth/request-context";
import {
  FAVORITES_DEFAULT_ITEM_HEIGHT,
  FAVORITES_DEFAULT_ITEM_WIDTH,
  findFirstAvailableFavoriteTilePosition,
} from "@/lib/favorites/layout";
import { favoriteFormSchema, favoriteGroupSchema } from "@/lib/favorites/schema";
import { logger } from "@/lib/logging/logger";

import type { FavoriteActionState } from "./state";

const favoritesLogger = logger.child("favorites");
const uuidSchema = z.string().uuid();

function getFavoriteInput(formData: FormData) {
  return favoriteFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    internalUrl: formData.get("internalUrl") ?? "",
    externalUrl: formData.get("externalUrl") ?? "",
    groupId: formData.get("groupId") ?? "",
    iconValue: formData.get("iconValue") ?? "globe-2",
    openMode: formData.get("openMode") ?? "new_tab",
    tags: formData.get("tags") ?? "",
    healthCheckEnabled: formData.get("healthCheckEnabled") === "on",
    healthCheckUrl: formData.get("healthCheckUrl") ?? "",
    isFavorite: formData.get("isFavorite") === "on",
  });
}

async function verifyGroupOwnership(
  userId: string,
  groupId: string | undefined,
): Promise<boolean> {
  if (!groupId) return true;
  const [group] = await db
    .select({ id: favoriteGroups.id })
    .from(favoriteGroups)
    .where(and(eq(favoriteGroups.id, groupId), eq(favoriteGroups.userId, userId)))
    .limit(1);
  return Boolean(group);
}

export async function createFavoriteAction(
  _previousState: FavoriteActionState,
  formData: FormData,
): Promise<FavoriteActionState> {
  const user = await requireRole("USER");
  const parsed = getFavoriteInput(formData);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Certains champs doivent être corrigés.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!(await verifyGroupOwnership(user.id, parsed.data.groupId))) {
    return { status: "error", message: "Le groupe sélectionné est invalide." };
  }

  try {
    const [[sortResult], existingTiles] = await Promise.all([
      db
        .select({ maximum: max(favorites.sortOrder) })
        .from(favorites)
        .where(eq(favorites.userId, user.id)),
      db
        .select({
          x: favorites.positionX,
          y: favorites.positionY,
          width: favorites.width,
          height: favorites.height,
        })
        .from(favorites)
        .where(eq(favorites.userId, user.id)),
    ]);

    const placement = findFirstAvailableFavoriteTilePosition(existingTiles);
    if (!placement) {
      return {
        status: "error",
        message: "Aucun emplacement libre n’est disponible pour ce favori.",
      };
    }

    const [created] = await db
      .insert(favorites)
      .values({
        userId: user.id,
        groupId: parsed.data.groupId ?? null,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        internalUrl: parsed.data.internalUrl ?? null,
        externalUrl: parsed.data.externalUrl ?? null,
        iconType: "lucide",
        iconValue: parsed.data.iconValue,
        tags: parsed.data.tags,
        openMode: parsed.data.openMode,
        healthCheckEnabled: parsed.data.healthCheckEnabled,
        healthCheckUrl: parsed.data.healthCheckUrl ?? null,
        sortOrder: Number(sortResult?.maximum ?? -1) + 1,
        isFavorite: parsed.data.isFavorite,
        positionX: placement.x,
        positionY: placement.y,
        width: FAVORITES_DEFAULT_ITEM_WIDTH,
        height: FAVORITES_DEFAULT_ITEM_HEIGHT,
      })
      .returning({ id: favorites.id });

    const context = await getRequestContext();
    await writeAuditLog({
      userId: user.id,
      action: "favorite.created",
      resourceType: "favorite",
      resourceId: created?.id,
      metadata: { name: parsed.data.name },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  } catch (error) {
    favoritesLogger.error("Unable to create favorite.", { error, userId: user.id });
    return { status: "error", message: "Le favori n’a pas pu être créé." };
  }

  revalidatePath("/favorites");
  revalidatePath("/dashboard");
  redirect("/favorites");
}

export async function updateFavoriteAction(
  favoriteId: string,
  _previousState: FavoriteActionState,
  formData: FormData,
): Promise<FavoriteActionState> {
  const user = await requireRole("USER");
  if (!uuidSchema.safeParse(favoriteId).success) {
    return { status: "error", message: "Identifiant de favori invalide." };
  }
  const parsed = getFavoriteInput(formData);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Certains champs doivent être corrigés.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!(await verifyGroupOwnership(user.id, parsed.data.groupId))) {
    return { status: "error", message: "Le groupe sélectionné est invalide." };
  }

  const [updated] = await db
    .update(favorites)
    .set({
      groupId: parsed.data.groupId ?? null,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      internalUrl: parsed.data.internalUrl ?? null,
      externalUrl: parsed.data.externalUrl ?? null,
      iconValue: parsed.data.iconValue,
      tags: parsed.data.tags,
      openMode: parsed.data.openMode,
      healthCheckEnabled: parsed.data.healthCheckEnabled,
      healthCheckUrl: parsed.data.healthCheckUrl ?? null,
      isFavorite: parsed.data.isFavorite,
      updatedAt: new Date(),
    })
    .where(and(eq(favorites.id, favoriteId), eq(favorites.userId, user.id)))
    .returning({ id: favorites.id });

  if (!updated) {
    return { status: "error", message: "Favori introuvable." };
  }

  const context = await getRequestContext();
  await writeAuditLog({
    userId: user.id,
    action: "favorite.updated",
    resourceType: "favorite",
    resourceId: updated.id,
    metadata: { name: parsed.data.name },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  revalidatePath("/favorites");
  revalidatePath("/dashboard");
  redirect("/favorites");
}

export async function deleteFavoriteAction(formData: FormData): Promise<void> {
  const user = await requireRole("USER");
  const favoriteId = String(formData.get("favoriteId") ?? "");
  if (!uuidSchema.safeParse(favoriteId).success) {
    return;
  }

  const [deleted] = await db
    .delete(favorites)
    .where(and(eq(favorites.id, favoriteId), eq(favorites.userId, user.id)))
    .returning({ id: favorites.id, name: favorites.name });

  if (deleted) {
    const context = await getRequestContext();
    await writeAuditLog({
      userId: user.id,
      action: "favorite.deleted",
      resourceType: "favorite",
      resourceId: deleted.id,
      metadata: { name: deleted.name },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  revalidatePath("/favorites");
  revalidatePath("/dashboard");
}

export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  const user = await requireRole("USER");
  const favoriteId = String(formData.get("favoriteId") ?? "");
  if (!uuidSchema.safeParse(favoriteId).success) {
    return;
  }
  const nextValue = formData.get("nextValue") === "true";

  const [updated] = await db
    .update(favorites)
    .set({ isFavorite: nextValue, updatedAt: new Date() })
    .where(and(eq(favorites.id, favoriteId), eq(favorites.userId, user.id)))
    .returning({ id: favorites.id, name: favorites.name });

  if (updated) {
    const context = await getRequestContext();
    await writeAuditLog({
      userId: user.id,
      action: nextValue ? "favorite.pinned" : "favorite.unpinned",
      resourceType: "favorite",
      resourceId: updated.id,
      metadata: { name: updated.name },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  revalidatePath("/favorites");
  revalidatePath("/dashboard");
}

export async function createGroupAction(
  _previousState: FavoriteActionState,
  formData: FormData,
): Promise<FavoriteActionState> {
  const user = await requireRole("USER");
  const parsed = favoriteGroupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    icon: formData.get("icon") ?? "server",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Le groupe n’a pas pu être créé.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const [sortResult] = await db
    .select({ maximum: max(favoriteGroups.sortOrder) })
    .from(favoriteGroups)
    .where(eq(favoriteGroups.userId, user.id));

  const [created] = await db
    .insert(favoriteGroups)
    .values({
      userId: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      icon: parsed.data.icon,
      sortOrder: Number(sortResult?.maximum ?? -1) + 1,
    })
    .returning({ id: favoriteGroups.id });

  const context = await getRequestContext();
  await writeAuditLog({
    userId: user.id,
    action: "favorite-group.created",
    resourceType: "favorite-group",
    resourceId: created?.id,
    metadata: { name: parsed.data.name },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  revalidatePath("/favorites");
  return { status: "idle", message: "Groupe créé." };
}
