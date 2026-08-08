ALTER TABLE "favorites" ADD COLUMN "position_x" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "favorites" ADD COLUMN "position_y" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "favorites" ADD COLUMN "width" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "favorites" ADD COLUMN "height" integer DEFAULT 3 NOT NULL;--> statement-breakpoint

WITH "ordered_favorites" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "user_id"
      ORDER BY "sort_order", "name", "id"
    ) - 1 AS "layout_index"
  FROM "favorites"
)
UPDATE "favorites"
SET
  "position_x" = (("ordered_favorites"."layout_index" % 4) * 3)::integer,
  "position_y" = ((("ordered_favorites"."layout_index" / 4) * 3))::integer
FROM "ordered_favorites"
WHERE "favorites"."id" = "ordered_favorites"."id";