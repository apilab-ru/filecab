import stylistic from '@stylistic/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.nx/**',
      '**/.wxt/**',
      '**/.output/**',
      '**/.idea/**',
      '**/.husky/**',
      'apps/api/src/generated/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: ['function', 'if', 'return'] },
        {
          blankLine: 'always',
          prev: '*',
          next: {
            selector:
              ':matches(ExportNamedDeclaration, ExportDefaultDeclaration)[declaration.type="FunctionDeclaration"]',
          },
        },
      ],
    },
  },
];
