-- Adds the provider to catalog cache rows so that an operator can clear one provider.
-- Existing rows cannot be attributed to a provider. They are only a cache, so remove them.
DELETE FROM "CatalogSearchCache";
DELETE FROM "CatalogMetadataCache";

ALTER TABLE "CatalogSearchCache" ADD COLUMN "provider" TEXT NOT NULL;
ALTER TABLE "CatalogMetadataCache" ADD COLUMN "provider" TEXT NOT NULL;

CREATE INDEX "CatalogSearchCache_provider_idx" ON "CatalogSearchCache"("provider");
CREATE INDEX "CatalogMetadataCache_provider_idx" ON "CatalogMetadataCache"("provider");
