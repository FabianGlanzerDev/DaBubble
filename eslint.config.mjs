import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.angular/**', 'test-results/**'] },
  {
    files: ['scripts/serve-static.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
  {
    files: ['scripts/account-deletion/**/*.mts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    files: ['src/**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      'max-lines-per-function': ['error', { max: 14, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
);
