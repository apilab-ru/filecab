import { execFileSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const storageBundle = resolve('apps/extension/.output/chrome-mv3/storage-test.js');

/** Builds the storage test bundle once, so parallel spec files never delete it for each other. */
export default function globalSetup() {
  execFileSync(
    'pnpm',
    ['--filter', '@filecab/extension', 'exec', 'node', 'scripts/build-storage-test.mjs'],
    { stdio: 'pipe' },
  );

  return async () => {
    await rm(storageBundle, { force: true });
  };
}
