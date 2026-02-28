import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      // Browser-safe library entry (no @github/copilot-sdk, no Node.js deps)
      entry: {
        index: resolve(__dirname, 'index.ts'),
        'index.node': resolve(__dirname, 'index.node.ts'),
        redacta: resolve(__dirname, 'bin/redacta.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        // Node.js built-ins
        'fs', 'path', 'url', 'child_process', 'util', 'events', 'stream', 'os', 'tty', 'readline', 'assert', 'crypto', 'buffer', 'process', 'module', 'v8', 'vm',
        // Runtime dependencies (kept external in all builds)
        '@github/copilot-sdk', 'dotenv', 'ink', 'react', 'yargs',
      ],
    },
    outDir: 'dist',
    target: 'node18',
    minify: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
});
