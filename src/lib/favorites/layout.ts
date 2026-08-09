import { z } from "zod";

export const FAVORITES_COLUMN_COUNT = 12;
export const FAVORITES_MAX_ITEMS = 96;
export const FAVORITES_MAX_ROWS = 200;
export const FAVORITES_MAX_ITEM_HEIGHT = 12;
export const FAVORITES_MIN_ITEM_WIDTH = 2;
export const FAVORITES_MIN_ITEM_HEIGHT = 2;
export const FAVORITES_DEFAULT_ITEM_WIDTH = 3;
export const FAVORITES_DEFAULT_ITEM_HEIGHT = 3;

export const favoriteLayoutItemSchema = z
  .object({
    id: z.string().uuid(),
    x: z
      .number()
      .int()
      .min(0)
      .max(FAVORITES_COLUMN_COUNT - 1),
    y: z.number().int().min(0).max(FAVORITES_MAX_ROWS),
    width: z.number().int().min(FAVORITES_MIN_ITEM_WIDTH).max(FAVORITES_COLUMN_COUNT),
    height: z
      .number()
      .int()
      .min(FAVORITES_MIN_ITEM_HEIGHT)
      .max(FAVORITES_MAX_ITEM_HEIGHT),
  })
  .superRefine((item, context) => {
    if (item.x + item.width > FAVORITES_COLUMN_COUNT) {
      context.addIssue({
        code: "custom",
        path: ["width"],
        message: `La tuile doit rester dans les ${FAVORITES_COLUMN_COUNT} colonnes de la grille.`,
      });
    }
  });

export const favoritesLayoutPayloadSchema = z
  .object({
    items: z.array(favoriteLayoutItemSchema).max(FAVORITES_MAX_ITEMS),
  })
  .superRefine((payload, context) => {
    const seen = new Set<string>();

    payload.items.forEach((item, index) => {
      if (seen.has(item.id)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "id"],
          message: "Un favori ne peut apparaître qu'une fois dans la disposition.",
        });
      }
      seen.add(item.id);
    });
  });

export type FavoriteLayoutItem = z.infer<typeof favoriteLayoutItemSchema>;

export type FavoriteGridLayoutInput = {
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
};

export type FavoriteTileRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function toBoundedInteger(
  value: number | undefined,
  min: number,
  max: number,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function rectanglesOverlap(left: FavoriteTileRect, right: FavoriteTileRect): boolean {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

export function findFirstAvailableFavoriteTilePosition(
  items: readonly FavoriteTileRect[],
  width = FAVORITES_DEFAULT_ITEM_WIDTH,
  height = FAVORITES_DEFAULT_ITEM_HEIGHT,
): { x: number; y: number } | null {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < FAVORITES_MIN_ITEM_WIDTH ||
    width > FAVORITES_COLUMN_COUNT ||
    height < FAVORITES_MIN_ITEM_HEIGHT ||
    height > FAVORITES_MAX_ITEM_HEIGHT
  ) {
    return null;
  }

  for (let y = 0; y <= FAVORITES_MAX_ROWS; y += 1) {
    for (let x = 0; x <= FAVORITES_COLUMN_COUNT - width; x += 1) {
      const candidate = { x, y, width, height };
      if (!items.some((item) => rectanglesOverlap(candidate, item))) {
        return { x, y };
      }
    }
  }

  return null;
}

export function buildDefaultFavoriteLayout(ids: readonly string[]): FavoriteLayoutItem[] {
  const itemsPerRow = Math.floor(FAVORITES_COLUMN_COUNT / FAVORITES_DEFAULT_ITEM_WIDTH);

  return ids.map((id, index) => ({
    id,
    x: (index % itemsPerRow) * FAVORITES_DEFAULT_ITEM_WIDTH,
    y: Math.floor(index / itemsPerRow) * FAVORITES_DEFAULT_ITEM_HEIGHT,
    width: FAVORITES_DEFAULT_ITEM_WIDTH,
    height: FAVORITES_DEFAULT_ITEM_HEIGHT,
  }));
}

export function normalizeFavoriteGridLayout(
  items: readonly FavoriteGridLayoutInput[],
): FavoriteLayoutItem[] {
  const normalized: FavoriteLayoutItem[] = [];

  for (const item of items) {
    if (!item.id) {
      continue;
    }

    const x = toBoundedInteger(item.x, 0, FAVORITES_COLUMN_COUNT - 1);
    const y = toBoundedInteger(item.y, 0, FAVORITES_MAX_ROWS);
    const requestedWidth = toBoundedInteger(
      item.w,
      FAVORITES_MIN_ITEM_WIDTH,
      FAVORITES_COLUMN_COUNT,
    );
    const height = toBoundedInteger(
      item.h,
      FAVORITES_MIN_ITEM_HEIGHT,
      FAVORITES_MAX_ITEM_HEIGHT,
    );

    if (x === null || y === null || requestedWidth === null || height === null) {
      continue;
    }

    normalized.push({
      id: item.id,
      x,
      y,
      width: Math.min(requestedWidth, FAVORITES_COLUMN_COUNT - x),
      height,
    });
  }

  return normalized.filter((item) => item.width >= FAVORITES_MIN_ITEM_WIDTH);
}

export function favoriteLayoutFingerprint(items: readonly FavoriteLayoutItem[]): string {
  return JSON.stringify(
    [...items]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(({ id, x, y, width, height }) => ({ id, x, y, width, height })),
  );
}
