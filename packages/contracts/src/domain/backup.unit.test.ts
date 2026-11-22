import { describe, expect, it } from 'vitest';
import { compareBackup, toBackup } from './backup';
import { emptySnapshot } from './rules';
import { Category, type Entry } from '../index';

/** Creates an active manual entry with the given title and modification time. */
function entry(id: string, userTitle: string, updatedAt = '2025-01-02T00:00:00.000Z'): Entry {
  return {
    schemaVersion: 1,
    entryId: id,
    catalogId: null,
    category: Category.Films,
    userTitle,
    status: null,
    rating: 0,
    progress: 0,
    comment: '',
    sources: [],
    snapshot: emptySnapshot(),
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt,
    serverVersion: '7',
    deleted: false,
  };
}

describe('backup export and comparison', () => {
  it('exports only active entries without server state', () => {
    const backup = toBackup([entry('a', 'A'), { ...entry('b', 'B'), deleted: true }]);

    expect(backup.schemaVersion).toBe(1);
    expect(backup.entries.map((item) => item.entryId)).toEqual(['a']);
    expect(backup.entries[0]).not.toHaveProperty('serverVersion');
    expect(backup.entries[0]).not.toHaveProperty('deleted');
    expect(backup.entries[0]).not.toHaveProperty('schemaVersion');
  });

  it('counts added, updated, unchanged and removed entries and newer local edits', () => {
    const current = [
      entry('same', 'Same'),
      entry('newer', 'Edited later', '2025-03-01T00:00:00.000Z'),
      entry('gone', 'Gone'),
      { ...entry('tombstone', 'Deleted'), deleted: true },
    ];
    const backup = toBackup([
      entry('same', 'Same'),
      entry('newer', 'Original'),
      entry('tombstone', 'Restored'),
    ]);

    expect(compareBackup(current, backup)).toEqual({
      current: 3,
      incoming: 3,
      added: 1,
      updated: 1,
      unchanged: 1,
      removed: 1,
      conflicts: 1,
    });
  });

  it('ignores key order in a parsed file', () => {
    const [exported] = toBackup([entry('a', 'A')]).entries;
    const reordered = Object.fromEntries(Object.entries(exported!).reverse()) as typeof exported;

    expect(compareBackup([entry('a', 'A')], { schemaVersion: 1, entries: [reordered!] })).toEqual(
      expect.objectContaining({ unchanged: 1, updated: 0 }),
    );
  });
});
