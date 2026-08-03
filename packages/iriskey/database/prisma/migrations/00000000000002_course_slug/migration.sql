-- Course.slug: a stable, human-readable address so links never point at a cuid.
-- Added nullable, backfilled from position, then tightened to NOT NULL so an
-- existing database with courses in it migrates without losing rows.

ALTER TABLE "Course" ADD COLUMN "slug" TEXT;

-- Existing rows take course-1, course-2, ... from their ordinal position.
UPDATE "Course" SET "slug" = 'course-' || "position" WHERE "slug" IS NULL;

-- Any collision (two courses sharing a position) falls back to the id, which
-- is unique by construction.
UPDATE "Course" c SET "slug" = 'course-' || c."position" || '-' || c."id"
WHERE EXISTS (
  SELECT 1 FROM "Course" o WHERE o."slug" = c."slug" AND o."id" <> c."id"
);

ALTER TABLE "Course" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");
CREATE INDEX "Course_slug_idx" ON "Course"("slug");
