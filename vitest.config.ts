import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      // Exclude files that have no testable runtime logic
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/tests/**',
        '**/src/tests/**',
        // CLI binary entry — calls process.exit(), not unit-testable
        '**/bin.ts',
        // Re-export barrels — no logic, just forwarding
        '**/index.ts',
        // Type-only files — no runtime code
        '**/types.ts',
        '**/interfaces.ts',
        // Vite/build artefacts
        '**/vite-env.d.ts',
        '**/vite.config.ts',
        '**/tailwind.config.js',
        '**/postcss.config.js'
      ],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 70
      }
    }
  }
});
