CREATE TABLE "GenreMappingConflict" (
    "id" UUID NOT NULL,
    "namespace" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "proposedKey" TEXT NOT NULL,
    "currentGenreId" UUID,
    "labels" JSONB NOT NULL,
    "provenance" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ(3),
    CONSTRAINT "GenreMappingConflict_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GenreMappingConflict_namespace_reviewedAt_createdAt_idx"
    ON "GenreMappingConflict"("namespace", "reviewedAt", "createdAt");
CREATE INDEX "GenreMappingConflict_externalId_namespace_idx"
    ON "GenreMappingConflict"("externalId", "namespace");
