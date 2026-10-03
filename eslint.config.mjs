import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: [
      'build/**',
      'dist/**',
      'artifacts/**',
      'tmp/**',
      '.cache/**',
      '.pnpm-store/**',
      'node_modules/**',
      'apps/desktop/native/bin/**',
      'apps/desktop/native/obj/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    files: ['apps/desktop/native/Bridge.js'],
    languageOptions: {
      globals: {
        __WINDOW_ID__: 'readonly',
        __MANAGED__: 'readonly',
        __TESTING__: 'readonly',
      },
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}', 'games/**/ui/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks, 'react-refresh': refresh },
    rules: {
      ...hooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
);
