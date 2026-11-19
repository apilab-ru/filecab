-- Maps Kinopoisk genre names to internal genres. The kinopoisk.dev API returns genre names, not IDs,
-- so the earlier numeric Kinopoisk rows cannot match catalog records.
INSERT INTO "GenreMapping" ("namespace", "externalId", "genreId", "provenance")
SELECT 'kinopoisk', mapping.name, genre."id",
    '{"source":"https://api.poiskkino.dev","retrievedAt":"2026-11-19T00:00:00.000Z","verified":false}'::jsonb
FROM (VALUES
    ('аниме', 'anime'),
    ('биография', 'biography'),
    ('боевик', 'action-battle'),
    ('вестерн', 'western'),
    ('военный', 'military'),
    ('детектив', 'detective'),
    ('детский', 'kids'),
    ('для взрослых', 'adult'),
    ('документальный', 'documentary'),
    ('драма', 'drama'),
    ('игра', 'game'),
    ('история', 'histori'),
    ('комедия', 'comedy'),
    ('концерт', 'concert'),
    ('короткометражка', 'short'),
    ('криминал', 'crime'),
    ('мелодрама', 'romance'),
    ('музыка', 'music'),
    ('мультфильм', 'сartoon'),
    ('мюзикл', 'musical'),
    ('новости', 'news'),
    ('приключения', 'adventure'),
    ('реальное тв', 'reality-show'),
    ('семейный', 'family'),
    ('спорт', 'sports'),
    ('ток-шоу', 'talk-show'),
    ('триллер', 'thriller'),
    ('ужасы', 'horror'),
    ('фантастика', 'sci-fi'),
    ('фильм-нуар', 'noir'),
    ('фэнтези', 'fantasy')
) AS mapping(name, key)
JOIN "Genre" genre ON genre."key" = mapping.key
ON CONFLICT ("namespace", "externalId") DO NOTHING;
