-- Adds durable jobs that find catalog data for entries without a catalog item (26 November 2026).
-- CreateTable
CREATE TABLE "CatalogMatchJob" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "state" TEXT NOT NULL,
    "entryIds" JSONB NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "counts" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "pause" TEXT,
    "pauses" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "CatalogMatchJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogMatchJob_state_runAfter_idx" ON "CatalogMatchJob"("state", "runAfter");

-- CreateIndex
CREATE INDEX "CatalogMatchJob_ownerId_createdAt_idx" ON "CatalogMatchJob"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CatalogMatchJob" ADD CONSTRAINT "CatalogMatchJob_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One queued or running job for each account.
CREATE UNIQUE INDEX "CatalogMatchJob_active_owner_key" ON "CatalogMatchJob"("ownerId")
  WHERE "state" IN ('queued', 'running');

ALTER TABLE "CatalogMatchJob" ADD CONSTRAINT "CatalogMatchJob_state_value"
  CHECK ("state" IN ('queued', 'running', 'succeeded', 'failed', 'cancelled'));
