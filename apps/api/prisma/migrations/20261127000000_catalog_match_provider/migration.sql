-- Gives each catalog provider its own catalog data job, so a provider limit or failure does not
-- stop the entries of another provider (24 November 2026).
-- Jobs from before this change used Kinopoisk for most entries.
ALTER TABLE "CatalogMatchJob" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'kinopoisk';
ALTER TABLE "CatalogMatchJob" ALTER COLUMN "provider" DROP DEFAULT;

-- One queued or running job for each account and provider.
DROP INDEX "CatalogMatchJob_active_owner_key";
CREATE UNIQUE INDEX "CatalogMatchJob_active_owner_provider_key"
  ON "CatalogMatchJob"("ownerId", "provider")
  WHERE "state" IN ('queued', 'running');

-- Entries can join an active job. The wait for unsynced device entries counts from the last join.
ALTER TABLE "CatalogMatchJob" ADD COLUMN "enqueuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "CatalogMatchJob" SET "enqueuedAt" = "createdAt";
