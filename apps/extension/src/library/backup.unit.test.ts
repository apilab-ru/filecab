import { describe, expect, it } from 'vitest';
import { BackupValidationError } from '@filecab/library';
import { emptySnapshot } from '@filecab/contracts';
import { parseBackup } from './backup';

const first = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';

/** Creates a valid portable manual entry. */
function entry(entryId: string, link = 'https://example.com/a') {
  return {
    entryId,
    catalogId: null,
    category: 'films',
    userTitle: 'Title',
    status: null,
    rating: 0,
    progress: 0,
    comment: '',
    sources: [
      { originalUrl: link, normalizedUrl: new URL(link).href, policyVersion: 'generic-v1' },
    ],
    snapshot: emptySnapshot(),
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
  };
}

/** Returns the issue paths of a rejected backup text. */
function issuePaths(value: unknown): unknown[] {
  try {
    parseBackup(typeof value === 'string' ? value : JSON.stringify(value));
  } catch (error) {
    if (error instanceof BackupValidationError) return error.issues.map((issue) => issue.path);
  }

  throw new Error('The backup was accepted');
}

describe('device backup validation', () => {
  it('accepts the current format', () => {
    const backup = { schemaVersion: 1, entries: [entry(first)] };

    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  });

  it('rejects invalid JSON, old formats and unknown fields', () => {
    expect(issuePaths('{')).toEqual([[]]);
    expect(issuePaths([entry(first)]).length).toBeGreaterThan(0);
    expect(issuePaths({ data: { films: [] } }).length).toBeGreaterThan(0);
    expect(issuePaths({ schemaVersion: 2, entries: [] })).toEqual([['schemaVersion']]);
    expect(
      issuePaths({ schemaVersion: 1, entries: [{ ...entry(first), deleted: false }] }),
    ).toEqual([['entries', 0]]);
  });

  it('reports the index of every invalid entry', () => {
    const paths = issuePaths({
      schemaVersion: 1,
      entries: [
        entry(first),
        { ...entry(second, 'https://example.com/b'), rating: 11 },
        { ...entry(first, 'https://example.com/c'), createdAt: 'yesterday' },
      ],
    });

    expect(paths).toContainEqual(['entries', 1, 'rating']);
    expect(paths).toContainEqual(['entries', 2, 'createdAt']);
  });

  it('rejects repeated identities, shared links and unsafe links', () => {
    const paths = issuePaths({
      schemaVersion: 1,
      entries: [
        entry(first),
        entry(first, 'https://example.com/a'),
        { ...entry(second, 'ftp://example.com/x') },
      ],
    });

    expect(paths).toEqual([
      ['entries', 1, 'entryId'],
      ['entries', 1, 'sources', 0, 'normalizedUrl'],
      ['entries', 2, 'sources', 0, 'originalUrl'],
    ]);
  });
});
