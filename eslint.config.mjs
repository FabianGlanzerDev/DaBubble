import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

const namingConvention = [
  'error',
  { selector: 'default', format: ['camelCase'] },
  { selector: 'typeLike', format: ['PascalCase'] },
  { selector: 'import', format: ['camelCase', 'PascalCase'] },
  {
    selector: ['objectLiteralProperty', 'typeProperty'],
    modifiers: ['requiresQuotes'],
    format: null,
  },
];

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.angular/**', 'test-results/**'] },
  {
    files: ['scripts/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
    rules: {
      'max-lines-per-function': ['error', { max: 14, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['scripts/account-deletion/**/*.mts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/naming-convention': namingConvention,
      'max-lines-per-function': ['error', { max: 14, skipBlankLines: true, skipComments: true }],
    },
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
      '@typescript-eslint/naming-convention': namingConvention,
      'max-lines-per-function': ['error', { max: 14, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
);
