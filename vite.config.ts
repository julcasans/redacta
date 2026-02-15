import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'bin/redacta.ts'),
      fileName: 'redacta',
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        // dependencies to keep external (not bundled)
        'fs', 'path', 'url', 'child_process', 'util', 'events', 'stream', 'os', 'tty', 'readline', 'assert', 'crypto', 'buffer', 'process', 'module', 'v8', 'vm',
        '@github/copilot-sdk', 'dotenv', 'ink', 'react', 'yargs',
        // devDependencies usually don't need to be here for a CLI build unless used at runtime
      ],
    },
    outDir: 'dist/bin',
    target: 'node18', // Target Node.js environment
    minify: false, // Optional: keep code readable for CLI
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
