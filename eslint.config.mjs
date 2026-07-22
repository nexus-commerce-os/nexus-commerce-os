// NEXUS Commerce OS — root ESLint flat config (ESLint 9 / typescript-eslint).
// One lint system for every TS/TSX workspace (services, packages, apps). Each
// workspace's `eslint src` resolves this config by walking up to the repo root.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/coverage/**', '**/*.d.ts'],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...js.configs.recommended,
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // Scaffold-friendly: unused vars are a warning (not a merge blocker) at P0.1;
      // tighten to "error" as real implementations land.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
);
