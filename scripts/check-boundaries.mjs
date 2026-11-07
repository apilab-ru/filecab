import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtinModules } from 'node:module';
import ts from 'typescript';

const ignored = new Set(['node_modules', 'dist', '.wxt', '.output', 'generated']);

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignored.has(entry.name)) return [];

    const path = join(directory, entry.name);

    return entry.isDirectory() ? files(path) : [path];
  });
}

function imports(source) {
  const result = [];

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    )
      result.push(node.moduleSpecifier.text);

    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    )
      result.push(node.moduleReference.expression.text);

    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    )
      result.push(node.argument.literal.text);

    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const argument = node.arguments[0];
      // Non-literal loads evade static ownership checks; require review instead.
      result.push(
        argument && ts.isStringLiteralLike(argument) ? argument.text : '<dynamic-module>',
      );
    }

    ts.forEachChild(node, visit);
  }
  visit(source);

  return result;
}

/** Checks manifest dependencies and source edges, including TS path aliases. */
export function checkBoundaries(root) {
  root = resolve(root);
  const projects = ['apps', 'packages'].flatMap((group) =>
    readdirSync(join(root, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const path = join(root, group, entry.name);

        return {
          path,
          id: `${group}/${entry.name}`,
          manifest: JSON.parse(readFileSync(join(path, 'package.json'), 'utf8')),
        };
      }),
  );
  const owner = (path) =>
    projects.find((project) => path === project.path || path.startsWith(project.path + sep));
  const allowedWorkspace = {
    'apps/api': ['packages/contracts'],
    'apps/web': ['packages/library', 'packages/ui', 'packages/contracts'],
    'apps/extension': ['packages/library', 'packages/ui', 'packages/contracts'],
    'packages/library': ['packages/ui', 'packages/contracts'],
    'packages/ui': [],
    'packages/contracts': [],
  };
  const violations = [];
  const fail = (path, message) => violations.push(`${relative(root, path)}: ${message}`);
  const serverOnly = (name) =>
    /^(?:@prisma\/|prisma(?:\/|$)|pg(?:\/|$)|@nestjs\/|class-validator(?:\/|$)|class-transformer(?:\/|$)|dotenv(?:\/|$)|@filecab\/api(?:\/|$))/.test(
      name,
    );
  const dataLayer = (name) =>
    /^(?:rxdb(?:\/|$)|dexie(?:\/|$)|@tanstack\/react-query(?:\/|$))/.test(name);
  for (const project of projects) {
    const client = project.id !== 'apps/api';
    const dependencies = {
      ...project.manifest.dependencies,
      ...project.manifest.devDependencies,
      ...project.manifest.peerDependencies,
      ...project.manifest.optionalDependencies,
    };
    const validateEdge = (name, target, path) => {
      if (client && serverOnly(name)) fail(path, `server-only dependency ${name}`);

      if (['packages/ui', 'packages/contracts'].includes(project.id) && dataLayer(name))
        fail(path, `data adapter dependency ${name}`);

      if (target && target.id !== project.id && !allowedWorkspace[project.id]?.includes(target.id))
        fail(path, `forbidden workspace dependency ${target.id}`);
    };
    for (const [name, version] of Object.entries(dependencies)) {
      validateEdge(
        name,
        projects.find((candidate) => candidate.manifest.name === name),
        join(project.path, 'package.json'),
      );

      if (typeof version === 'string' && version.startsWith('npm:'))
        validateEdge(
          version.slice(4).replace(/@[^@/]+$/, ''),
          undefined,
          join(project.path, 'package.json'),
        );
    }
    const configPath = ts.findConfigFile(project.path, ts.sys.fileExists, 'tsconfig.json');
    let options = {};

    if (configPath) {
      const config = ts.readConfigFile(configPath, ts.sys.readFile);
      options = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath)).options;
    }

    for (const path of files(project.path).filter((path) => /\.[cm]?[jt]sx?$/.test(path))) {
      const text = readFileSync(path, 'utf8');
      const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
      for (const name of imports(source)) {
        if (name === '<dynamic-module>') {
          fail(path, 'non-literal module loading cannot be checked');
          continue;
        }

        const resolved = ts.resolveModuleName(name, path, options, ts.sys).resolvedModule
          ?.resolvedFileName;
        const targetPath =
          resolved ?? (name.startsWith('.') ? resolve(dirname(path), name) : undefined);
        const target = targetPath
          ? owner(targetPath)
          : projects.find(
              (candidate) =>
                name === candidate.manifest.name || name.startsWith(candidate.manifest.name + '/'),
            );
        validateEdge(name, target, path);

        if (
          client &&
          /(?:src|entrypoints)\//.test(relative(project.path, path)) &&
          (name.startsWith('node:') || builtinModules.includes(name))
        )
          fail(path, `Node-only module in client source ${name}`);

        if (
          client &&
          (/(^|\/)\.env(?:\.|$)/.test(name) ||
            (targetPath && /(^|\/)\.env(?:\.|$)/.test(targetPath)))
        )
          fail(path, 'environment file import');

        if (name.startsWith('.') && targetPath && !target)
          fail(path, 'relative import leaves workspace projects');
      }

      if (client && /(?:src|entrypoints)\//.test(relative(project.path, path))) {
        // Analyze member access rather than matching text in comments or strings.
        const member = (node) => {
          if (ts.isPropertyAccessExpression(node)) return node.name.text;

          if (
            ts.isElementAccessExpression(node) &&
            node.argumentExpression &&
            ts.isStringLiteralLike(node.argumentExpression)
          )
            return node.argumentExpression.text;

          return undefined;
        };
        const isMember = (node) =>
          ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node);
        const isClientEnv = (node) =>
          isMember(node) &&
          member(node) === 'env' &&
          ts.isMetaProperty(node.expression) &&
          node.expression.keywordToken === ts.SyntaxKind.ImportKeyword;

        function inspect(node) {
          if (isClientEnv(node)) {
            const parent = node.parent;
            const key = isMember(parent) && parent.expression === node ? member(parent) : undefined;

            if (
              !key ||
              ![
                'DEV',
                'PROD',
                'MODE',
                'BASE_URL',
                'SSR',
                'VITE_API_ORIGIN',
                'WXT_PUBLIC_API_ORIGIN',
              ].includes(key)
            )
              fail(
                path,
                `non-allowlisted client environment access ${key ?? '(dynamic or whole environment)'}`,
              );
          }

          if (
            isMember(node) &&
            member(node) === 'env' &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'process'
          )
            fail(path, 'server process environment in client source');

          ts.forEachChild(node, inspect);
        }
        inspect(source);
      }
    }
  }

  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = checkBoundaries(resolve(dirname(fileURLToPath(import.meta.url)), '..'));

  if (violations.length) {
    console.error(violations.join('\n'));
    process.exitCode = 1;
  } else console.log('Workspace boundaries verified.');
}
