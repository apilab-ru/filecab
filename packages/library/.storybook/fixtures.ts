import {
  Category,
  Format,
  Granularity,
  ListSyncField,
  Status,
  type Entry,
  type Genre,
  type ListSyncImportPreview,
  type LocalizedText,
  type Provenance,
  type Snapshot,
} from '@filecab/contracts';

const PROVENANCE: Provenance = {
  source: 'storybook',
  retrievedAt: '2026-11-01T00:00:00.000Z',
  verified: true,
};

/** Builds an inline poster so that stories do not depend on the network. */
function poster(from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="340"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="240" height="340" fill="url(#g)"/></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Builds one localized text with story provenance. */
function text(value: string, language: string): LocalizedText {
  return { text: value, language, provenance: PROVENANCE };
}

/** Builds one genre with English and Russian labels. */
function genre(key: string, en: string, ru: string): Genre {
  return { genreId: `genre-${key}`, key, labels: [text(en, 'en'), text(ru, 'ru')] };
}

export const GENRES: Genre[] = [
  genre('action', 'Action', 'Экшен'),
  genre('adventure', 'Adventure', 'Приключения'),
  genre('drama', 'Drama', 'Драма'),
  genre('romance', 'Romance', 'Романтика'),
  genre('psychological', 'Psychological', 'Психологическое'),
];

export const SNAPSHOT: Snapshot = {
  originalTitle: text('Hoshi no Kaze', 'ja'),
  titles: [text('Wind of the Stars', 'en'), text('Звёздный ветер', 'ru')],
  descriptions: [
    text('A courier crosses a quiet planet to deliver the last letter of a lost crew.', 'en'),
    text(
      'Курьер пересекает тихую планету, чтобы доставить последнее письмо пропавшего экипажа.',
      'ru',
    ),
  ],
  posterUrl: poster('#3b5bdb', '#0ca678'),
  year: 2024,
  genres: GENRES.slice(0, 3),
  format: Format.Tv,
  episodeCount: 12,
  availableEpisodeCount: 12,
  providerRatings: [{ value: 8.4, scale: 10, provenance: PROVENANCE }],
  references: [
    {
      namespace: 'storybook',
      entity: 'anime',
      id: '1',
      granularity: Granularity.Unknown,
      provenance: PROVENANCE,
    },
  ],
};

export const ENTRY: Entry = {
  schemaVersion: 1,
  entryId: 'entry-1',
  catalogId: 'catalog-1',
  category: Category.Anime,
  userTitle: '',
  status: Status.Process,
  rating: 8,
  progress: 5,
  comment: 'Watch with subtitles.',
  sources: [],
  snapshot: SNAPSHOT,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  serverVersion: '1',
  deleted: false,
};

export const IMPORT_PREVIEW: ListSyncImportPreview = {
  schemaVersion: 1,
  jobId: 'job-1',
  additions: [
    {
      key: 'remote-1',
      title: 'Wind of the Stars',
      category: Category.Anime,
      values: { status: Status.Process, rating: 8, progress: 5 },
    },
    {
      key: 'remote-2',
      title: 'Harbor Lights',
      category: Category.Anime,
      values: { status: Status.Planned, rating: 0, progress: 0 },
    },
  ],
  changes: [
    {
      key: 'remote-3',
      entryId: 'entry-3',
      title: 'Silent Orchard',
      fields: [
        { field: ListSyncField.Status, current: Status.Process, incoming: Status.Complete },
        { field: ListSyncField.Progress, current: 10, incoming: 24 },
      ],
    },
    {
      key: 'remote-4',
      entryId: 'entry-4',
      title: 'Paper Moon Station',
      fields: [{ field: ListSyncField.Rating, current: 0, incoming: 9 }],
    },
  ],
  unchanged: 37,
};
