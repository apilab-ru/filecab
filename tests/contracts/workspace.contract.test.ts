import { expect, test } from 'vitest';
import { checkBoundaries } from '../../scripts/check-boundaries.mjs';
import { resolve } from 'node:path';

test('production projects preserve the client/server dependency contract', () => {
  expect(checkBoundaries(resolve(import.meta.dirname, '../..'))).toEqual([]);
});
