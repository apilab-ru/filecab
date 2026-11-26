import { Category } from '../models/category';
import { Granularity } from '../models/granularity';
import type { Entry } from '../models/index';
import type {
  LibraryImportIssue,
  LibraryImportPlanRow,
  LibraryImportReference,
  LibraryImportRow,
} from '../models/library-import';
import { LibraryImportIssueCode } from '../models/library-import-issue-code';
import { LibraryImportOutcome, LibraryImportReason } from '../models/library-import-outcome';
import { Status } from '../models/status';
import { normalizeTitleForMatch } from './catalog-match';
import { emptySnapshot, normalizeSourceUrl } from './rules';

/** A file can be at most 10 MiB. */
export const LIBRARY_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

/** A file can have at most 10,000 data rows. */
export const LIBRARY_IMPORT_MAX_ROWS = 10_000;

const MAX_TITLE_LENGTH = 500;

const MAX_COMMENT_LENGTH = 100_000;

/** The columns of the import format. */
type Column =
  | 'category'
  | 'title'
  | 'year'
  | 'status'
  | 'rating'
  | 'progress'
  | 'comment'
  | 'link'
  | 'reference';

const REQUIRED_COLUMNS: readonly Column[] = ['category', 'title'];

/** Maps normalized header names, in English and Russian, to columns. */
const COLUMN_ALIASES: Readonly<Record<string, Column>> = {
  category: 'category',
  type: 'category',
  kind: 'category',
  категория: 'category',
  тип: 'category',
  title: 'title',
  name: 'title',
  название: 'title',
  наименование: 'title',
  year: 'year',
  год: 'year',
  status: 'status',
  статус: 'status',
  rating: 'rating',
  score: 'rating',
  'my rating': 'rating',
  оценка: 'rating',
  'моя оценка': 'rating',
  рейтинг: 'rating',
  progress: 'progress',
  episodes: 'progress',
  прогресс: 'progress',
  эпизоды: 'progress',
  серии: 'progress',
  comment: 'comment',
  note: 'comment',
  notes: 'comment',
  комментарий: 'comment',
  заметка: 'comment',
  link: 'link',
  url: 'link',
  ссылка: 'link',
  reference: 'reference',
  ref: 'reference',
};

/** Maps normalized category values, in English and Russian, to categories. */
const CATEGORY_ALIASES: Readonly<Record<string, Category>> = {
  anime: Category.Anime,
  аниме: Category.Anime,
  films: Category.Films,
  film: Category.Films,
  movie: Category.Films,
  movies: Category.Films,
  фильм: Category.Films,
  фильмы: Category.Films,
  tv: Category.Tv,
  'tv series': Category.Tv,
  'tv show': Category.Tv,
  series: Category.Tv,
  serial: Category.Tv,
  сериал: Category.Tv,
  сериалы: Category.Tv,
};

/** Maps normalized status values, in English and Russian, to statuses. */
const STATUS_ALIASES: Readonly<Record<string, Status>> = {
  planned: Status.Planned,
  plan: Status.Planned,
  'plan to watch': Status.Planned,
  запланировано: Status.Planned,
  'буду смотреть': Status.Planned,
  process: Status.Process,
  watching: Status.Process,
  смотрю: Status.Process,
  complete: Status.Complete,
  completed: Status.Complete,
  watched: Status.Complete,
  просмотрено: Status.Complete,
  drop: Status.Drop,
  dropped: Status.Drop,
  брошено: Status.Drop,
  hide: Status.Hide,
  hidden: Status.Hide,
  скрыто: Status.Hide,
};

/** Describes one supported reference: its ID format and its categories. */
interface ReferenceRule {
  pattern: RegExp;
  categories: readonly Category[];
}

/** The supported references, keyed by `namespace:entity`. */
const REFERENCE_RULES: Readonly<Record<string, ReferenceRule>> = {
  'kinopoisk:title': { pattern: /^[1-9]\d*$/, categories: [Category.Films, Category.Tv] },
  'imdb:title': { pattern: /^tt\d+$/, categories: [Category.Films, Category.Tv] },
  'tmdb:movie': { pattern: /^[1-9]\d*$/, categories: [Category.Films] },
  'tmdb:tv': { pattern: /^[1-9]\d*$/, categories: [Category.Tv] },
  'smotret:series': { pattern: /^[1-9]\d*$/, categories: [Category.Anime] },
  'shikimori:anime': { pattern: /^[1-9]\d*$/, categories: [Category.Anime] },
  'myanimelist:anime': { pattern: /^[1-9]\d*$/, categories: [Category.Anime] },
  'anidb:anime': { pattern: /^[1-9]\d*$/, categories: [Category.Anime] },
};

/** The separators that the import detects, in order of preference for a tie. */
const SEPARATORS = [',', ';', '\t'] as const;

/** One parsed CSV record with the physical line where it starts. */
interface CsvRecord {
  line: number;
  values: string[];
}

/** Lowercases and collapses spaces, so case and spacing do not change a match. */
function normalizeKey(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Counts separators outside quotes in the header line and selects the most frequent one. */
function detectSeparator(text: string): string {
  const counts = new Map<string, number>(SEPARATORS.map((separator) => [separator, 0]));
  let quoted = false;

  for (const character of text) {
    if (character === '"') quoted = !quoted;
    else if (!quoted && (character === '\n' || character === '\r')) break;
    else if (!quoted && counts.has(character)) counts.set(character, counts.get(character)! + 1);
  }

  return SEPARATORS.reduce((best, separator) =>
    counts.get(separator)! > counts.get(best)! ? separator : best,
  );
}

/** Parses RFC 4180 records. Quoted values can hold separators, quotes and line breaks. */
function parseRecords(text: string, separator: string): CsvRecord[] | LibraryImportIssue {
  const records: CsvRecord[] = [];
  let values: string[] = [];
  let value = '';
  let quoted = false;
  let line = 1;
  let start = 1;
  let index = 0;

  while (index < text.length) {
    const character = text[index]!;

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 2;
        continue;
      }

      if (character === '"') quoted = false;
      else value += character;

      if (character === '\n') line += 1;

      index += 1;
      continue;
    }

    if (character === '"' && !value.trim()) {
      quoted = true;
      value = '';
    } else if (character === separator) {
      values.push(value);
      value = '';
    } else if (character === '\r' || character === '\n') {
      values.push(value);
      records.push({ line: start, values });
      values = [];
      value = '';

      if (character === '\r' && text[index + 1] === '\n') index += 1;

      line += 1;
      start = line;
    } else value += character;

    index += 1;
  }

  if (quoted) return { line: start, column: null, code: LibraryImportIssueCode.UnclosedQuote };

  if (value || values.length) {
    values.push(value);
    records.push({ line: start, values });
  }

  // Empty lines carry no data.
  return records.filter((record) => record.values.some((item) => item.trim()));
}

/** Parses an optional integer in a range. */
function integer(value: string, minimum: number, maximum: number): number | null | undefined {
  if (!value) return null;

  if (!/^\d+$/.test(value)) return undefined;

  const number = Number(value);

  return number >= minimum && number <= maximum ? number : undefined;
}

/** Parses an absolute HTTP or HTTPS link without credentials. */
function link(value: string): string | null | undefined {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return undefined;

    return url.href;
  } catch {
    return undefined;
  }
}

/** Parses `namespace:entity:id` and checks the ID format. */
function reference(value: string): LibraryImportReference | null | undefined {
  if (!value) return null;

  const parts = value.split(':');

  if (parts.length !== 3) return undefined;

  const [namespace, entity, id] = parts.map((part) => part.trim()) as [string, string, string];
  const rule = REFERENCE_RULES[`${namespace}:${entity}`];

  if (!rule || !rule.pattern.test(id)) return undefined;

  return { namespace, entity, id };
}

/** Validates one record against the header columns. */
function parseRow(
  record: CsvRecord,
  columns: Array<{ column: Column; name: string }>,
  issues: LibraryImportIssue[],
): LibraryImportRow | null {
  const before = issues.length;
  const fail = (column: Column | null, code: LibraryImportIssueCode) =>
    issues.push({
      line: record.line,
      column: column ? (columns.find((item) => item.column === column)?.name ?? column) : null,
      code,
    });

  if (record.values.length > columns.length) fail(null, LibraryImportIssueCode.ExtraValues);

  const raw = new Map<Column, string>(
    columns.map(({ column }, index) => [column, (record.values[index] ?? '').trim()]),
  );
  const get = (column: Column) => raw.get(column) ?? '';
  const category = CATEGORY_ALIASES[normalizeKey(get('category'))];

  if (!category) fail('category', LibraryImportIssueCode.InvalidCategory);

  const title = get('title');

  if (!title || title.length > MAX_TITLE_LENGTH) fail('title', LibraryImportIssueCode.InvalidTitle);

  const year = integer(get('year'), 1, 9999);

  if (year === undefined) fail('year', LibraryImportIssueCode.InvalidYear);

  const statusText = get('status');
  const status = statusText ? STATUS_ALIASES[normalizeKey(statusText)] : null;

  if (status === undefined) fail('status', LibraryImportIssueCode.InvalidStatus);

  const rating = integer(get('rating'), 1, 10);

  if (rating === undefined) fail('rating', LibraryImportIssueCode.InvalidRating);

  const progress = integer(get('progress'), 0, Number.MAX_SAFE_INTEGER);

  if (progress === undefined) fail('progress', LibraryImportIssueCode.InvalidProgress);

  const comment = get('comment');

  if (comment.length > MAX_COMMENT_LENGTH) fail('comment', LibraryImportIssueCode.InvalidComment);

  const url = link(get('link'));

  if (url === undefined) fail('link', LibraryImportIssueCode.InvalidLink);

  const parsed = reference(get('reference'));

  if (parsed === undefined) fail('reference', LibraryImportIssueCode.InvalidReference);
  else if (
    parsed &&
    category &&
    !REFERENCE_RULES[`${parsed.namespace}:${parsed.entity}`]!.categories.includes(category)
  )
    fail('reference', LibraryImportIssueCode.ReferenceCategory);

  if (issues.length > before) return null;

  // Without a status, a rated title counts as watched and an unrated title as planned.
  const statusFromRating = status === null;

  return {
    line: record.line,
    category: category!,
    title,
    year: year ?? null,
    status: status ?? (rating ? Status.Complete : Status.Planned),
    statusFromRating,
    rating: rating ?? 0,
    progress: progress ?? 0,
    comment,
    link: url ?? null,
    reference: parsed ?? null,
  };
}

/**
 * Parses and validates a CSV import file. It detects a comma, semicolon or tab separator.
 * Column names and category and status values are not case-sensitive and have English and
 * Russian aliases. Returns all issues of a file that is not valid, and no rows.
 */
export function parseLibraryImport(text: string): {
  rows: LibraryImportRow[];
  issues: LibraryImportIssue[];
} {
  if (new TextEncoder().encode(text).length > LIBRARY_IMPORT_MAX_BYTES)
    return {
      rows: [],
      issues: [{ line: 0, column: null, code: LibraryImportIssueCode.FileTooLarge }],
    };

  const content = text.startsWith('﻿') ? text.slice(1) : text;
  const records = parseRecords(content, detectSeparator(content));

  if (!Array.isArray(records)) return { rows: [], issues: [records] };

  const [header, ...data] = records;

  if (!header || !data.length)
    return { rows: [], issues: [{ line: 1, column: null, code: LibraryImportIssueCode.Empty }] };

  if (data.length > LIBRARY_IMPORT_MAX_ROWS)
    return {
      rows: [],
      issues: [{ line: 0, column: null, code: LibraryImportIssueCode.TooManyRows }],
    };

  const issues: LibraryImportIssue[] = [];
  const columns: Array<{ column: Column; name: string }> = [];

  for (const name of header.values.map((value) => value.trim())) {
    const column = COLUMN_ALIASES[normalizeKey(name)];

    if (!column) issues.push({ line: 1, column: name, code: LibraryImportIssueCode.UnknownColumn });
    else if (columns.some((item) => item.column === column))
      issues.push({ line: 1, column: name, code: LibraryImportIssueCode.DuplicateColumn });
    else columns.push({ column, name });
  }

  for (const column of REQUIRED_COLUMNS)
    if (!columns.some((item) => item.column === column))
      issues.push({ line: 1, column, code: LibraryImportIssueCode.MissingColumn });

  if (issues.length) return { rows: [], issues };

  const rows = data.flatMap((record) => parseRow(record, columns, issues) ?? []);

  return issues.length ? { rows: [], issues } : { rows, issues: [] };
}

/** Builds a reference key. */
function referenceKey(value: LibraryImportReference): string {
  return `${value.namespace}\u0000${value.entity}\u0000${value.id}`;
}

/** Builds a title key. The year is separate, so a missing year can match any year. */
function titleKey(category: Category, title: string): string {
  return `${category}\u0000${normalizeTitleForMatch(title)}`;
}

/** Returns true when two optional years do not contradict each other. */
function yearsAgree(a: number | null, b: number | null): boolean {
  return a === null || b === null || a === b;
}

/**
 * Decides the outcome of each row against the active entries and the earlier rows. A same
 * reference or link skips the row. A same title marks a possible duplicate, only for a row
 * without a reference. Titles never prove identity.
 */
export function planLibraryImport(
  rows: readonly LibraryImportRow[],
  entries: readonly Entry[],
): LibraryImportPlanRow[] {
  const active = entries.filter((entry) => !entry.deleted);
  const references = new Set(
    active.flatMap((entry) => entry.snapshot.references.map((item) => referenceKey(item))),
  );
  const links = new Set(
    active.flatMap((entry) => entry.sources.map((source) => source.normalizedUrl)),
  );
  const titles = new Map<string, Array<number | null>>();
  const addTitle = (map: Map<string, Array<number | null>>, key: string, year: number | null) =>
    map.set(key, [...(map.get(key) ?? []), year]);

  for (const entry of active)
    for (const title of new Set(
      [entry.userTitle, ...entry.snapshot.titles.map((item) => item.text)].filter((text) =>
        text.trim(),
      ),
    ))
      addTitle(titles, titleKey(entry.category, title), entry.snapshot.year);

  const seenReferences = new Set<string>();
  const seenLinks = new Set<string>();
  const seenTitles = new Map<string, Array<number | null>>();

  return rows.map((row) => {
    const plan = (outcome: LibraryImportOutcome, reason: LibraryImportReason | null) => ({
      ...row,
      outcome,
      reason,
    });
    const key = row.reference ? referenceKey(row.reference) : null;
    const normalizedLink = row.link ? normalizeSourceUrl(row.link) : null;
    const title = titleKey(row.category, row.title);
    let result: LibraryImportPlanRow;

    if (key && references.has(key))
      result = plan(LibraryImportOutcome.Skip, LibraryImportReason.SameReference);
    else if (normalizedLink && links.has(normalizedLink))
      result = plan(LibraryImportOutcome.Skip, LibraryImportReason.SameLink);
    else if (key && seenReferences.has(key))
      result = plan(LibraryImportOutcome.Skip, LibraryImportReason.RepeatedReference);
    else if (normalizedLink && seenLinks.has(normalizedLink))
      result = plan(LibraryImportOutcome.Skip, LibraryImportReason.RepeatedLink);
    else if (!key && titles.get(title)?.some((year) => yearsAgree(year, row.year)))
      result = plan(LibraryImportOutcome.PossibleDuplicate, LibraryImportReason.SameTitle);
    else if (!key && seenTitles.get(title)?.some((year) => yearsAgree(year, row.year)))
      result = plan(LibraryImportOutcome.PossibleDuplicate, LibraryImportReason.RepeatedTitle);
    else result = plan(LibraryImportOutcome.Add, null);

    if (key) seenReferences.add(key);

    if (normalizedLink) seenLinks.add(normalizedLink);

    addTitle(seenTitles, title, row.year);

    return result;
  });
}

/**
 * Builds a new entry from a row. The title and year form a user snapshot without a catalog
 * item. The reference stays unverified.
 */
export function importedEntry(row: LibraryImportRow, entryId: string, now: string): Entry {
  const snapshot = emptySnapshot();
  snapshot.year = row.year;

  if (row.reference)
    snapshot.references = [
      {
        ...row.reference,
        granularity: Granularity.Unknown,
        provenance: { source: 'csv-import', retrievedAt: now, verified: false },
      },
    ];

  return {
    schemaVersion: 1,
    entryId,
    catalogId: null,
    category: row.category,
    userTitle: row.title,
    status: row.status,
    rating: row.rating,
    progress: row.progress,
    comment: row.comment,
    sources: row.link
      ? [
          {
            originalUrl: row.link,
            normalizedUrl: normalizeSourceUrl(row.link),
            policyVersion: 'generic-v1',
          },
        ]
      : [],
    snapshot,
    createdAt: now,
    updatedAt: now,
    serverVersion: null,
    deleted: false,
  };
}
