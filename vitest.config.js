import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use happy-dom for better performance (or jsdom for full compatibility)
    environment: 'happy-dom',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.test.js',
        '**/*.spec.js',
        '**/dist/',
        '**/Example.html',
        '**/dynamic/',
        'check-loc.js',
        'test-disambiguation.js',
        'dynamic-content-test.html'
      ],
      include: [
        'yeh/**/*.js',
        'yai-core.js',
        'tabs/**/*.js',
        'utils/**/*.js',
        'worker/yai-worker.js',
        'worker/internal/*.js'
      ],
      // Thresholds for CI
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70
    },

    // Global test timeout
    testTimeout: 10000,

    // Setup files
    setupFiles: ['./test/setup.js'],

    // Include/exclude patterns. __yai-toggle is an unintegrated staging area
    // whose tests target the planned src/ layout, not this package tree.
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'build', '**/__yai-toggle/**'],

    // Reporter configuration
    reporters: ['verbose'],

    // Globals (optional - allows using describe/it without imports)
    globals: true,
  },
});
