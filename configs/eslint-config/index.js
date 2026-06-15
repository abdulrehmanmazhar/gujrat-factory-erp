import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export default defineConfig({
    languageOptions: {
        parserOptions: {
            project: true,
            tsconfigRootDir: process.cwd()
        }
    },
    files: ['**/*.ts'],
    ignores: ['node_modules/**', 'dist/**'],
    extends: [eslint.configs.recommended, tseslint.configs.recommendedTypeChecked, eslintConfigPrettier],
    rules: {
        'no-console': 'error',
        quotes: ['error', 'single', { allowTemplateLiterals: true }],
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
})
