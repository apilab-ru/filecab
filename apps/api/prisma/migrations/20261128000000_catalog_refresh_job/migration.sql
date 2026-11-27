-- Adds durable jobs that read the provider details of stored catalog items again (28 November 2026).
-- CreateTable
CREATE TABLE "CatalogRefreshJob" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "cursor" UUID,
    "counts" JSONB NOT NULL,
    "entries" INTEGER NOT NULL DEFAULT 0,
    "pauses" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "CatalogRefreshJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogRefreshJob_state_runAfter_idx" ON "CatalogRefreshJob"("state", "runAfter");

-- CreateIndex
CREATE INDEX "CatalogRefreshJob_provider_createdAt_idx" ON "CatalogRefreshJob"("provider", "createdAt");

-- One queued or running job for each provider.
CREATE UNIQUE INDEX "CatalogRefreshJob_active_provider_key" ON "CatalogRefreshJob"("provider")
  WHERE "state" IN ('queued', 'running');

ALTER TABLE "CatalogRefreshJob" ADD CONSTRAINT "CatalogRefreshJob_state_value"
  CHECK ("state" IN ('queued', 'running', 'succeeded', 'failed'));
