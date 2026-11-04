-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "googleSubject" TEXT NOT NULL,
    "revision" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogReference" (
    "namespace" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "catalogId" UUID NOT NULL,
    "provenance" JSONB NOT NULL,

    CONSTRAINT "CatalogReference_pkey" PRIMARY KEY ("namespace","entity","externalId")
);

-- CreateTable
CREATE TABLE "CatalogTranslation" (
    "id" UUID NOT NULL,
    "catalogId" UUID NOT NULL,
    "language" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "provenance" JSONB NOT NULL,

    CONSTRAINT "CatalogTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "labels" JSONB NOT NULL,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenreMapping" (
    "namespace" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "genreId" UUID NOT NULL,
    "provenance" JSONB NOT NULL,

    CONSTRAINT "GenreMapping_pkey" PRIMARY KEY ("namespace","externalId")
);

-- CreateTable
CREATE TABLE "LibraryEntry" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "catalogId" UUID,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "document" JSONB NOT NULL,

    CONSTRAINT "LibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceAssociation" (
    "normalizedHash" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "entryId" UUID NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "SourceAssociation_pkey" PRIMARY KEY ("ownerId","normalizedHash")
);

-- CreateTable
CREATE TABLE "EntryChange" (
    "ownerId" UUID NOT NULL,
    "revision" BIGINT NOT NULL,
    "entryId" UUID NOT NULL,
    "document" JSONB NOT NULL,
    "committedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryChange_pkey" PRIMARY KEY ("ownerId","revision")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshHash_key" ON "Session"("refreshHash");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_key_key" ON "Genre"("key");

-- CreateIndex
CREATE INDEX "LibraryEntry_ownerId_deleted_idx" ON "LibraryEntry"("ownerId", "deleted");

-- CreateIndex
CREATE UNIQUE INDEX "SourceAssociation_entryId_position_key" ON "SourceAssociation"("entryId", "position");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogReference" ADD CONSTRAINT "CatalogReference_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogTranslation" ADD CONSTRAINT "CatalogTranslation_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenreMapping" ADD CONSTRAINT "GenreMapping_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryEntry" ADD CONSTRAINT "LibraryEntry_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryEntry" ADD CONSTRAINT "LibraryEntry_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAssociation" ADD CONSTRAINT "SourceAssociation_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LibraryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryChange" ADD CONSTRAINT "EntryChange_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "LibraryEntry_active_catalog_key" ON "LibraryEntry" ("ownerId", "catalogId") WHERE NOT "deleted" AND "catalogId" IS NOT NULL;

ALTER TABLE "User" ADD CONSTRAINT "User_revision_nonnegative" CHECK (revision >= 0);

ALTER TABLE "SourceAssociation" ADD CONSTRAINT "SourceAssociation_hash_matches_url" CHECK ("normalizedHash" = encode(sha256(convert_to("normalizedUrl", 'UTF8')), 'hex'));
