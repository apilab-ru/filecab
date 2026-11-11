CREATE TABLE "CatalogSearchCache" (
    "requestKey" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "staleUntil" TIMESTAMPTZ(3) NOT NULL,
    "lastAccessedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "CatalogSearchCache_pkey" PRIMARY KEY ("requestKey")
);

CREATE INDEX "CatalogSearchCache_identityKey_fetchedAt_idx"
    ON "CatalogSearchCache"("identityKey", "fetchedAt");
CREATE INDEX "CatalogSearchCache_expiresAt_idx"
    ON "CatalogSearchCache"("expiresAt");

CREATE TABLE "CatalogMetadataCache" (
    "catalogId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "schema" INTEGER NOT NULL,
    "record" JSONB NOT NULL,
    "provenance" JSONB NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "CatalogMetadataCache_pkey" PRIMARY KEY ("catalogId", "locale", "schema"),
    CONSTRAINT "CatalogMetadataCache_catalogId_fkey" FOREIGN KEY ("catalogId")
        REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CatalogMetadataCache_expiresAt_idx"
    ON "CatalogMetadataCache"("expiresAt");
