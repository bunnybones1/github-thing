import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import eslintConfigPrettier from 'eslint-config-prettier'
import prettier from 'eslint-plugin-prettier'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const baseConfig = {
  extends: [
    js.configs.recommended,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
    eslintConfigPrettier,
  ],
  plugins: {
    '@typescript-eslint': tseslint,
    prettier,
  },
  languageOptions: {
    ecmaVersion: 2020,
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 'latest',
      ecmaFeatures: { jsx: true },
      sourceType: 'module',
    },
  },
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    'prettier/prettier': 'error',
  },
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    ...baseConfig,
    languageOptions: {
      ...baseConfig.languageOptions,
      globals: globals.browser,
    },
  },
  {
    files: [
      '*.config.{js,ts}',
      'vite.config.{js,ts}',
      'playwright.config.{js,ts}',
      'eslint.config.js',
      'tests/**/*.{js,ts,tsx}',
    ],
    ...baseConfig,
    languageOptions: {
      ...baseConfig.languageOptions,
      globals: globals.node,
    },
  },
])
