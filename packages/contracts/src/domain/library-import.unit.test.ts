import { describe, expect, test } from 'vitest';
import { Category } from '../models/category';
import type { Entry } from '../models/index';
import { LibraryImportIssueCode } from '../models/library-import-issue-code';
import { LibraryImportOutcome, LibraryImportReason } from '../models/library-import-outcome';
import { Status } from '../models/status';
import {
  LIBRARY_IMPORT_MAX_ROWS,
  importedEntry,
  parseLibraryImport,
  planLibraryImport,
} from './library-import';

/** Parses a file that must be valid. */
function rows(text: string) {
  const result = parseLibraryImport(text);
  expect(result.issues).toEqual([]);

  return result.rows;
}

/** Builds an active entry with a title, year, references and links. */
function entry(fields: Partial<Entry> & { title: string; year?: number | null }): Entry {
  const built = importedEntry(
    {
      line: 0,
      category: fields.category ?? Category.Films,
      title: fields.title,
      year: fields.year ?? null,
      status: null,
      statusFromRating: false,
      rating: 0,
      progress: 0,
      comment: '',
      link: null,
      reference: null,
    },
    crypto.randomUUID(),
    '2026-11-24T00:00:00.000Z',
  );

  return { ...built, ...fields, snapshot: { ...built.snapshot, ...fields.snapshot } };
}

describe('CSV format', () => {
  test('reads a semicolon file with aliased columns and category values', () => {
    const parsed = rows(
      '﻿Title;Type;Rating;Year\nБезумные родители;Film;6;2017\nДандадан;Anime;;2024\nСлушатели;TV series;10;2024\n',
    );
    expect(
      parsed.map(({ category, title, rating, year }) => ({ category, title, rating, year })),
    ).toEqual([
      { category: Category.Films, title: 'Безумные родители', rating: 6, year: 2017 },
      { category: Category.Anime, title: 'Дандадан', rating: 0, year: 2024 },
      { category: Category.Tv, title: 'Слушатели', rating: 10, year: 2024 },
    ]);
  });

  test('takes the status from the rating only when the file gives none', () => {
    const parsed = rows('category,title,status,rating\nfilms,A,,7\nfilms,B,,\nfilms,C,Брошено,9\n');
    expect(parsed.map(({ status, statusFromRating }) => [status, statusFromRating])).toEqual([
      [Status.Complete, true],
      [Status.Planned, true],
      [Status.Drop, false],
    ]);
  });

  test('keeps quoted separators, quotes and line breaks, and counts physical lines', () => {
    const parsed = rows(
      'category,title,comment\r\nfilms,"Up, Down","He said ""hi""\nand left"\r\ntv,Next,\r\n',
    );
    expect(parsed[0]).toMatchObject({
      line: 2,
      title: 'Up, Down',
      comment: 'He said "hi"\nand left',
    });
    expect(parsed[1]).toMatchObject({ line: 4, title: 'Next' });
  });

  test('reports every value error with its line and column and returns no rows', () => {
    const result = parseLibraryImport(
      [
        'category,title,year,rating,progress,link,reference',
        'cartoon,A,,,,,',
        'films,,1994,11,-1,ftp://x,',
        'tv,B,,,,https://user:pass@example.com/,kinopoisk:title:abc',
        'anime,C,,,,,kinopoisk:title:326',
      ].join('\n'),
    );
    expect(result.rows).toEqual([]);
    expect(result.issues).toEqual([
      { line: 2, column: 'category', code: LibraryImportIssueCode.InvalidCategory },
      { line: 3, column: 'title', code: LibraryImportIssueCode.InvalidTitle },
      { line: 3, column: 'rating', code: LibraryImportIssueCode.InvalidRating },
      { line: 3, column: 'progress', code: LibraryImportIssueCode.InvalidProgress },
      { line: 3, column: 'link', code: LibraryImportIssueCode.InvalidLink },
      { line: 4, column: 'link', code: LibraryImportIssueCode.InvalidLink },
      { line: 4, column: 'reference', code: LibraryImportIssueCode.InvalidReference },
      { line: 5, column: 'reference', code: LibraryImportIssueCode.ReferenceCategory },
    ]);
  });

  test('rejects unknown, duplicate and missing columns', () => {
    expect(parseLibraryImport('Title;Название;Genre\nA;B;C\n').issues).toEqual([
      { line: 1, column: 'Название', code: LibraryImportIssueCode.DuplicateColumn },
      { line: 1, column: 'Genre', code: LibraryImportIssueCode.UnknownColumn },
      { line: 1, column: 'category', code: LibraryImportIssueCode.MissingColumn },
    ]);
  });

  test('rejects empty files, unclosed quotes, extra values and too many rows', () => {
    expect(parseLibraryImport('category,title\n').issues[0]!.code).toBe(
      LibraryImportIssueCode.Empty,
    );
    expect(parseLibraryImport('category,title\nfilms,"open\n').issues[0]).toEqual({
      line: 2,
      column: null,
      code: LibraryImportIssueCode.UnclosedQuote,
    });
    expect(parseLibraryImport('category,title\nfilms,A,extra\n').issues[0]!.code).toBe(
      LibraryImportIssueCode.ExtraValues,
    );
    const many = `category,title\n${'films,A\n'.repeat(LIBRARY_IMPORT_MAX_ROWS + 1)}`;
    expect(parseLibraryImport(many).issues[0]!.code).toBe(LibraryImportIssueCode.TooManyRows);
  });

  test('keeps the IMDb prefix and checks each reference category', () => {
    const parsed = rows(
      [
        'category,title,reference',
        'films,A,imdb:title:tt0111161',
        'tv,B,tmdb:tv:1399',
        'anime,C,shikimori:anime:5114',
      ].join('\n'),
    );
    expect(parsed.map((row) => row.reference?.id)).toEqual(['tt0111161', '1399', '5114']);
    expect(
      parseLibraryImport('category,title,reference\ntv,A,tmdb:movie:1\n').issues[0]!.code,
    ).toBe(LibraryImportIssueCode.ReferenceCategory);
  });
});

describe('import plan', () => {
  test('skips same references and links, and repeated rows of the file', () => {
    const existing = entry({
      title: 'Old',
      sources: [
        {
          originalUrl: 'https://example.com/watch',
          normalizedUrl: 'https://example.com/watch',
          policyVersion: 'generic-v1',
        },
      ],
      snapshot: {
        ...entry({ title: 'x' }).snapshot,
        references: [
          {
            namespace: 'kinopoisk',
            entity: 'title',
            id: '326',
            granularity: 'unknown' as Entry['snapshot']['references'][number]['granularity'],
            provenance: { source: 'catalog', retrievedAt: '', verified: true },
          },
        ],
      },
    });
    const plan = planLibraryImport(
      rows(
        [
          'category,title,link,reference',
          'films,One,,kinopoisk:title:326',
          'films,Two,https://example.com/watch,',
          'films,Three,,kinopoisk:title:1',
          'films,Four,,kinopoisk:title:1',
          'films,Five,https://example.com/other,',
          'films,Six,https://example.com/other,',
        ].join('\n'),
      ),
      [existing],
    );
    expect(plan.map((row) => [row.outcome, row.reason])).toEqual([
      [LibraryImportOutcome.Skip, LibraryImportReason.SameReference],
      [LibraryImportOutcome.Skip, LibraryImportReason.SameLink],
      [LibraryImportOutcome.Add, null],
      [LibraryImportOutcome.Skip, LibraryImportReason.RepeatedReference],
      [LibraryImportOutcome.Add, null],
      [LibraryImportOutcome.Skip, LibraryImportReason.RepeatedLink],
    ]);
  });

  test('marks equal titles as possible duplicates only when years agree', () => {
    const plan = planLibraryImport(
      rows(
        [
          'category,title,year,reference',
          'films,  ЁЛКИ ,2010,',
          'films,Ёлки,2011,',
          'tv,Ёлки,2010,',
          'films,Ёлки,2010,kinopoisk:title:5',
          'films,New,,',
          'films,new,1999,',
        ].join('\n'),
      ),
      [entry({ title: 'Елки', year: 2010 }), entry({ title: 'Deleted', deleted: true })],
    );
    expect(plan.map((row) => [row.outcome, row.reason])).toEqual([
      [LibraryImportOutcome.PossibleDuplicate, LibraryImportReason.SameTitle],
      [LibraryImportOutcome.Add, null],
      [LibraryImportOutcome.Add, null],
      // A reference identifies the title, so the title does not matter.
      [LibraryImportOutcome.Add, null],
      [LibraryImportOutcome.Add, null],
      [LibraryImportOutcome.PossibleDuplicate, LibraryImportReason.RepeatedTitle],
    ]);
  });

  test('a new entry keeps the user title, year, link and an unverified reference', () => {
    const [row] = rows(
      'category,title,year,status,rating,progress,comment,link,reference\nanime,Fullmetal,2009,process,9,12,Note,HTTPS://Example.com/a,shikimori:anime:5114\n',
    );
    const created = importedEntry(row!, 'id-1', '2026-11-24T00:00:00.000Z');
    expect(created).toMatchObject({
      entryId: 'id-1',
      catalogId: null,
      category: Category.Anime,
      userTitle: 'Fullmetal',
      status: Status.Process,
      rating: 9,
      progress: 12,
      comment: 'Note',
      sources: [{ originalUrl: 'https://example.com/a', normalizedUrl: 'https://example.com/a' }],
      snapshot: {
        year: 2009,
        references: [
          {
            namespace: 'shikimori',
            entity: 'anime',
            id: '5114',
            provenance: { verified: false },
          },
        ],
      },
    });
  });
});
