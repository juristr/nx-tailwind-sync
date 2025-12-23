import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['e2e/**/*.e2e.spec.ts'],
    testTimeout: 120000, // 2min per test
    hookTimeout: 120000, // 2min for beforeAll workspace setup
  },
});
