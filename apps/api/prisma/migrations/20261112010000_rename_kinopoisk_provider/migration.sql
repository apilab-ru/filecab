-- Rename the provider key while preserving the canonical Kinopoisk reference namespace.
DELETE FROM "GenreMapping" AS old_mapping
USING "GenreMapping" AS new_mapping
WHERE old_mapping."namespace" = 'kinopoisk-dev'
  AND new_mapping."namespace" = 'kinopoisk'
  AND old_mapping."externalId" = new_mapping."externalId';

UPDATE "GenreMapping"
SET "namespace" = 'kinopoisk'
WHERE "namespace" = 'kinopoisk-dev';

DELETE FROM "GenreMappingConflict" AS old_conflict
USING "GenreMappingConflict" AS new_conflict
WHERE old_conflict."namespace" = 'kinopoisk-dev'
  AND new_conflict."namespace" = 'kinopoisk'
  AND old_conflict."externalId" = new_conflict."externalId'
  AND old_conflict."proposedKey" = new_conflict."proposedKey';

UPDATE "GenreMappingConflict"
SET "namespace" = 'kinopoisk'
WHERE "namespace" = 'kinopoisk-dev';
