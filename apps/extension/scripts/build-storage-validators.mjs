import { writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { createRxSchema } from 'rxdb/plugins/core';
import { getAjv } from 'rxdb/plugins/validate-ajv';

const directory = new URL('../src/library/', import.meta.url);
const imports = [];
const entries = [];

for (const [index, name] of [
  'entry',
  'settings',
  'binding',
  'issue',
  'merge',
  'issue-v0',
  'merge-v0',
].entries()) {
  const schema = JSON.parse(readFileSync(new URL(`${name}.schema.json`, directory), 'utf8'));
  const jsonSchema = createRxSchema(schema).jsonSchema;
  const ajv = getAjv();
  ajv.opts.code = { ...ajv.opts.code, source: true, esm: true };
  const helpers = new Map();
  const generated = standaloneCode(ajv, ajv.compile(jsonSchema));
  const body = generated.replace(/require\("([^"\n]+)"\)/g, (_, path) => {
    if (!helpers.has(path)) helpers.set(path, `helper${helpers.size}`);

    return helpers.get(path);
  });
  const code =
    [...helpers]
      .map(
        ([path, identifier]) => `import * as ${identifier} from ${JSON.stringify(`${path}.js`)};`,
      )
      .join('\n') +
    '\n' +
    body;
  await writeFile(new URL(`generated-validator-${index}.mjs`, directory), code);
  imports.push(`import v${index} from './generated-validator-${index}.mjs';`);
  entries.push(`${JSON.stringify(`${schema.title}/${schema.version}`)}: v${index}`);
}
// The backup validator is not a storage schema. It reports all errors, so the owner sees every
// invalid entry index at once.
const backupAjv = new Ajv({ allErrors: true, code: { source: true, esm: true } });
addFormats(backupAjv);
const backupSchema = JSON.parse(readFileSync(new URL('backup.schema.json', directory), 'utf8'));
const backupHelpers = new Map();
const backupBody = standaloneCode(backupAjv, backupAjv.compile(backupSchema)).replace(
  /require\("([^"\n]+)"\)/g,
  (_, path) => {
    if (!backupHelpers.has(path)) backupHelpers.set(path, `helper${backupHelpers.size}`);

    return backupHelpers.get(path);
  },
);
await writeFile(
  new URL('generated-backup-validator.mjs', directory),
  [...backupHelpers]
    .map(([path, identifier]) => `import * as ${identifier} from ${JSON.stringify(`${path}.js`)};`)
    .join('\n') +
    '\n' +
    backupBody,
);
await writeFile(
  new URL('generated-validators.mjs', directory),
  `${imports.join('\n')}\nexport const validatorBySchema = {${entries.join(',')}};\n`,
);
