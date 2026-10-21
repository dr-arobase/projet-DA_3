import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'serveur/src/uploads/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['serveur/src/**/*.js', 'serveur/tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
];
