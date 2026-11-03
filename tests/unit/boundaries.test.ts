import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkBoundaries } from '../../scripts/check-boundaries.mjs';

const temporary: string[] = [];
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });
function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'filecab-boundaries-'));
  temporary.push(root);
  for (const [project, name] of [['apps/api', '@filecab/api'], ['apps/web', '@filecab/web'], ['packages/ui', '@filecab/ui'], ['packages/contracts', '@filecab/contracts']]) {
    mkdirSync(join(root, project, 'src'), { recursive: true });
    writeFileSync(join(root, project, 'package.json'), JSON.stringify({ name }));
    writeFileSync(join(root, project, 'tsconfig.json'), JSON.stringify({ compilerOptions: { moduleResolution: 'Bundler', baseUrl: '.', paths: { '@server/*': ['../api/src/*'] } } }));
  }
  writeFileSync(join(root, 'apps/api/src/private.ts'), 'export const privateValue = 1;');
  return root;
}

describe('workspace boundary enforcement', () => {
  it('permits client contracts', () => {
    const root = workspace();
    writeFileSync(join(root, 'apps/web/src/main.ts'), "import type { Entry } from '@filecab/contracts';");
    expect(checkBoundaries(root)).toEqual([]);
  });
  it.each([
    "import '@prisma/client';",
    "export * from '../../api/src/private';",
    "import { privateValue } from '@server/private';",
    "const backend = require('../../api/src/private');",
    "type Backend = import('../../api/src/private').Backend;",
    "import '../.env';",
    "const key = import.meta.env.VITE_SESSION_SECRET;",
    "const key = process.env.SESSION_SECRET;",
    "const key = import.meta.env['VITE_SESSION_SECRET'];",
    "const secrets = import.meta.env;",
    "const key = process['env'].SESSION_SECRET;",
    "import fs from 'node:fs';",
    "const load = (path) => import(path);",
  ])('rejects a leaking edge: %s', source => {
    const root = workspace();
    writeFileSync(join(root, 'apps/web/src/main.ts'), source);
    expect(checkBoundaries(root).length).toBeGreaterThan(0);
  });
  it('rejects npm aliases of server dependencies', () => {
    const root = workspace();
    writeFileSync(join(root, 'apps/web/package.json'), JSON.stringify({ name: '@filecab/web', dependencies: { database: 'npm:@prisma/client@7.10.1' } }));
    expect(checkBoundaries(root)).toEqual(expect.arrayContaining([expect.stringContaining('server-only dependency @prisma/client')]));
  });
  it('rejects transitive manifest dependencies and UI data adapters', () => {
    const root = workspace();
    writeFileSync(join(root, 'packages/ui/package.json'), JSON.stringify({ name: '@filecab/ui', dependencies: { '@tanstack/react-query': '*', '@filecab/api': 'workspace:*' } }));
    expect(checkBoundaries(root)).toEqual(expect.arrayContaining([
      expect.stringContaining('data adapter dependency @tanstack/react-query'),
      expect.stringContaining('forbidden workspace dependency apps/api'),
    ]));
  });
});
