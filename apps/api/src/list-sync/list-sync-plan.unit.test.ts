import { describe, expect, test } from 'vitest';
import { ListSyncField, ListSyncIssue, Status, type ListSyncValues } from '@filecab/contracts';
import { planExport, planImport } from './list-sync-plan';

const FIELDS = [ListSyncField.Status, ListSyncField.Rating, ListSyncField.Progress];

const STATUSES = [Status.Planned, Status.Process, Status.Complete, Status.Drop];

/** Creates a value set with defaults. */
function values(overrides: Partial<ListSyncValues> = {}): ListSyncValues {
  return { status: Status.Process, rating: 0, progress: 0, ...overrides };
}

describe('planExport', () => {
  test('creates a missing record with all enabled fields', () => {
    expect(planExport(values({ rating: 8, progress: 3 }), null, FIELDS, STATUSES)).toEqual({
      kind: 'create',
      values: { status: Status.Process, rating: 8, progress: 3 },
    });
  });

  test('skips a missing record when the status cannot be stored', () => {
    for (const status of [null, Status.Hide])
      expect(planExport(values({ status }), null, FIELDS, STATUSES)).toEqual({
        kind: 'skip',
        issue: ListSyncIssue.UnsupportedStatus,
      });
  });

  test('replaces only different remote values, including a cleared rating', () => {
    expect(
      planExport(
        values({ rating: 0, progress: 5 }),
        values({ rating: 7, progress: 5 }),
        FIELDS,
        STATUSES,
      ),
    ).toEqual({ kind: 'update', values: { rating: 0 } });
  });

  test('keeps the remote status of a hidden entry', () => {
    expect(
      planExport(
        values({ status: Status.Hide }),
        values({ status: Status.Complete }),
        FIELDS,
        STATUSES,
      ),
    ).toEqual({ kind: 'unchanged' });
  });

  test('does not write disabled fields', () => {
    expect(planExport(values({ rating: 9 }), values(), [ListSyncField.Status], STATUSES)).toEqual({
      kind: 'unchanged',
    });
  });
});

describe('planImport', () => {
  test('lists different fields with both values', () => {
    expect(planImport(values({ progress: 2 }), values({ progress: 4, rating: 6 }), FIELDS)).toEqual(
      [
        { field: ListSyncField.Rating, current: 0, incoming: 6 },
        { field: ListSyncField.Progress, current: 2, incoming: 4 },
      ],
    );
  });

  test('ignores a remote status without a Filecab equivalent', () => {
    expect(planImport(values(), values({ status: null }), FIELDS)).toEqual([]);
  });

  test('does not unhide a hidden entry', () => {
    expect(
      planImport(values({ status: Status.Hide }), values({ status: Status.Drop }), FIELDS),
    ).toEqual([]);
  });
});
