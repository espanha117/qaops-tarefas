import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/services/**/*.js'],
      thresholds: {
        lines: 75,
        statements: 75,
        functions: 75,
        branches: 60,
      },
    },
  },
});
