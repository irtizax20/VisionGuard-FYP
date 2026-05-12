const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.venv311/*', 'ml/*', 'scripts/*'],
    rules: {
      // Disable warnings that don't affect functionality
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-named-as-default': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-redeclare': 'off',
    },
  },
]);
