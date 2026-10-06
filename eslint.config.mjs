import { defineConfig } from 'eslint/config';
import next from 'eslint-config-next/core-web-vitals';
import ts from 'eslint-config-next/typescript';
export default defineConfig([
  {
    ignores: [
      '**/.next/**',
      '**/next-env.d.ts',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  ...next,
  ...ts,
  { settings: { next: { rootDir: 'apps/web/' } } },
]);
