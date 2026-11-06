import { build } from 'vite';
import { fileURLToPath } from 'node:url';

await build({
  configFile: false,
  build: {
    emptyOutDir: false,
    outDir: fileURLToPath(new URL('../.output/chrome-mv3', import.meta.url)),
    lib: {
      entry: fileURLToPath(new URL('../../../tests/e2e/fixtures/storage.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'storage-test.js',
    },
  },
});
