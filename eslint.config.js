const expoConfig = require('eslint-config-expo/flat')
const prettierConfig = require('eslint-config-prettier/flat')
const tsPlugin = require('@typescript-eslint/eslint-plugin')

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    // flat config는 커스텀 룰을 쓰는 객체에서 플러그인을 직접 등록해야 함
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['node_modules/', 'dist/', '.expo/', 'supabase/functions/'],
  },
]
