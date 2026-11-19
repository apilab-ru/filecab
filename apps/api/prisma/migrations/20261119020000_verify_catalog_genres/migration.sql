-- Verifies provider genre mappings against live provider data (19 November 2026).
-- Kinopoisk: GET /v1/movie/possible-values-by-field?field=genres.name returned 32 names.
-- Smotret: GET /api/series?fields=id,genres, 61 pages, 29,723 series, 74 genre IDs.
-- Each verified mapping also passed a semantic review of the provider and internal genres.

-- Kinopoisk "игра" names TV game shows. It is not the anime "game" theme.
INSERT INTO "Genre" ("id", "key", "labels") VALUES
    ('6102b8b9-3e80-40b2-a1ff-b5a8bf90af4b'::uuid, 'game-show', '[{"text":"Игровое шоу","language":"ru","provenance":{"source":"filecab","retrievedAt":"2026-11-19T13:05:00.000Z","verified":true}},{"text":"Game show","language":"en","provenance":{"source":"filecab","retrievedAt":"2026-11-19T13:05:00.000Z","verified":true}}]'::jsonb)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "GenreCategory" ("genreId", "category")
SELECT "id", 'tv' FROM "Genre" WHERE "key" = 'game-show'
ON CONFLICT DO NOTHING;

UPDATE "GenreMapping"
SET "genreId" = (SELECT "id" FROM "Genre" WHERE "key" = 'game-show')
WHERE "namespace" = 'kinopoisk' AND "externalId" = 'игра';

-- Catalog snapshots keep merged genres, so replace the old internal genre of Kinopoisk records.
UPDATE "CatalogItem"
SET "snapshot" = jsonb_set(
    "snapshot",
    '{genres}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN genre->>'key' = 'game'
                    THEN jsonb_build_object('genreId', target."id", 'key', target."key", 'labels', target."labels")
                ELSE genre
            END
        )
        FROM jsonb_array_elements("snapshot"->'genres') AS genre
    )
)
FROM "Genre" AS target
WHERE target."key" = 'game-show'
  AND "CatalogItem"."category" IN ('films', 'tv')
  AND "CatalogItem"."snapshot"->'genres' @> '[{"key":"game"}]'::jsonb;

DELETE FROM "CatalogSearchCache" WHERE "provider" = 'kinopoisk';
DELETE FROM "CatalogMetadataCache" WHERE "provider" = 'kinopoisk';

-- Catalog records contain Kinopoisk genre names. Numeric Kinopoisk IDs never match.
DELETE FROM "GenreMapping" WHERE "namespace" = 'kinopoisk' AND "externalId" ~ '^[0-9]+$';

-- The resolver ignores or converts these Smotret IDs before the lookup.
DELETE FROM "GenreMapping"
WHERE "namespace" = 'smotret' AND "externalId" IN ('46', '50', '54', '74', '77', '79');

UPDATE "GenreMapping"
SET "provenance" = '{"source":"https://api.poiskkino.dev/v1/movie/possible-values-by-field?field=genres.name","retrievedAt":"2026-11-19T13:05:00.000Z","verified":true}'::jsonb
WHERE "namespace" = 'kinopoisk'
  AND "externalId" IN (
    'аниме', 'биография', 'боевик', 'вестерн', 'военный', 'детектив', 'детский',
    'для взрослых', 'документальный', 'драма', 'игра', 'история', 'комедия', 'концерт',
    'короткометражка', 'криминал', 'мелодрама', 'музыка', 'мультфильм', 'мюзикл',
    'новости', 'приключения', 'реальное тв', 'семейный', 'спорт', 'ток-шоу', 'триллер',
    'ужасы', 'фантастика', 'фильм-нуар', 'фэнтези'
  );

-- IDs 12, 26 and 28 do not occur in public series and stay unverified.
UPDATE "GenreMapping"
SET "provenance" = '{"source":"https://smotret-anime.online/api/series","retrievedAt":"2026-11-19T13:05:00.000Z","verified":true}'::jsonb
WHERE "namespace" = 'smotret'
  AND "externalId" IN (
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '13', '14', '15', '16', '17',
    '18', '19', '20', '21', '22', '23', '24', '25', '27', '29', '30', '31', '32', '35', '36',
    '37', '38', '39', '40', '41', '42', '43', '47', '48', '49', '51', '52', '53', '55', '56',
    '57', '58', '59', '60', '61', '62', '63', '64', '66', '67', '68', '69', '70', '71', '72',
    '73', '75', '76', '78', '80', '82', '83'
  );
