const expoConfig = require('eslint-config-expo/flat')
const prettierConfig = require('eslint-config-prettier/flat')

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['node_modules/', 'dist/', '.expo/'],
  },
]
