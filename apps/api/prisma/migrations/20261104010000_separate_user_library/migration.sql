BEGIN;

CREATE TABLE "UserLibrary" (
    "ownerId" UUID NOT NULL,
    "revision" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "UserLibrary_pkey" PRIMARY KEY ("ownerId"),
    CONSTRAINT "UserLibrary_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserLibrary_revision_nonnegative" CHECK ("revision" >= 0)
);

-- Preserve all accounts and their existing replication positions, including empty libraries.
INSERT INTO "UserLibrary" ("ownerId", "revision") SELECT "id", "revision" FROM "User";

ALTER TABLE "LibraryEntry" DROP CONSTRAINT "LibraryEntry_ownerId_fkey";
ALTER TABLE "LibraryEntry" ADD CONSTRAINT "LibraryEntry_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "UserLibrary"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EntryChange" DROP CONSTRAINT "EntryChange_ownerId_fkey";
ALTER TABLE "EntryChange" ADD CONSTRAINT "EntryChange_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "UserLibrary"("ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" DROP COLUMN "revision";

COMMIT;
