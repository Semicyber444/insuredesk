import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    fileParallelism: false,
    globals: true,
    environment: 'node',
    globalSetup: ['./tests/support/globalSetup.ts'],
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? '' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
