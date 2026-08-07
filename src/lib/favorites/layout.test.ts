import { describe, expect, it } from "vitest";

import {
  FAVORITES_COLUMN_COUNT,
  FAVORITES_MAX_ITEMS,
  FAVORITES_MIN_ITEM_HEIGHT,
  FAVORITES_MIN_ITEM_WIDTH,
  favoriteLayoutFingerprint,
  favoritesLayoutPayloadSchema,
  findFirstAvailableFavoriteTilePosition,
  normalizeFavoriteGridLayout,
} from "./layout";

const favoriteId = "22222222-2222-4222-8222-222222222222";

describe("favorites layout validation", () => {
  it("accepts a bounded favorites layout", () => {
    const result = favoritesLayoutPayloadSchema.safeParse({
      items: [{ id: favoriteId, x: 0, y: 3, width: 3, height: 3 }],
    });

    expect(result.success).toBe(true);
  });

  it("rejects tiles outside the twelve-column grid", () => {
    const result = favoritesLayoutPayloadSchema.safeParse({
      items: [{ id: favoriteId, x: 11, y: 0, width: 2, height: 3 }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects tiles below minimum dimensions", () => {
    const result = favoritesLayoutPayloadSchema.safeParse({
      items: [{ id: favoriteId, x: 0, y: 0, width: 1, height: 1 }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate favorite identifiers", () => {
    const result = favoritesLayoutPayloadSchema.safeParse({
      items: [
        { id: favoriteId, x: 0, y: 0, width: 3, height: 3 },
        { id: favoriteId, x: 3, y: 0, width: 3, height: 3 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("bounds the number of tiles accepted in one request", () => {
    const items = Array.from({ length: FAVORITES_MAX_ITEMS + 1 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      x: 0,
      y: index,
      width: 3,
      height: 3,
    }));

    expect(favoritesLayoutPayloadSchema.safeParse({ items }).success).toBe(false);
  });
});

describe("favorites automatic placement", () => {
  it("starts an empty favorites grid at the top-left", () => {
    expect(findFirstAvailableFavoriteTilePosition([])).toEqual({ x: 0, y: 0 });
  });

  it("fills the first horizontal gap that can contain the default tile", () => {
    expect(
      findFirstAvailableFavoriteTilePosition([
        { x: 0, y: 0, width: 3, height: 3 },
        { x: 6, y: 0, width: 3, height: 3 },
        { x: 9, y: 0, width: 3, height: 3 },
      ]),
    ).toEqual({ x: 3, y: 0 });
  });

  it("moves to the first free row when the first row is occupied", () => {
    expect(
      findFirstAvailableFavoriteTilePosition([
        { x: 0, y: 0, width: 3, height: 3 },
        { x: 3, y: 0, width: 3, height: 3 },
        { x: 6, y: 0, width: 3, height: 3 },
        { x: 9, y: 0, width: 3, height: 3 },
      ]),
    ).toEqual({ x: 0, y: 3 });
  });

  it("rejects impossible requested dimensions", () => {
    expect(findFirstAvailableFavoriteTilePosition([], 1, 1)).toBeNull();
  });
});

describe("favorites GridStack normalization", () => {
  it("normalizes finite values and keeps tiles inside the desktop grid", () => {
    expect(
      normalizeFavoriteGridLayout([
        { id: favoriteId, x: 10.9, y: 3.8, w: 4, h: 2.9 },
        { id: "missing-values" },
      ]),
    ).toEqual([
      {
        id: favoriteId,
        x: 10,
        y: 3,
        width: 2,
        height: 2,
      },
    ]);
  });

  it("uses a stable fingerprint regardless of item ordering", () => {
    const first = [
      { id: "b", x: 3, y: 0, width: 3, height: 3 },
      { id: "a", x: 0, y: 0, width: 3, height: 3 },
    ];
    const second = [...first].reverse();

    expect(favoriteLayoutFingerprint(first)).toBe(favoriteLayoutFingerprint(second));
    expect(FAVORITES_COLUMN_COUNT).toBe(12);
    expect(FAVORITES_MIN_ITEM_WIDTH).toBe(2);
    expect(FAVORITES_MIN_ITEM_HEIGHT).toBe(2);
  });
});
