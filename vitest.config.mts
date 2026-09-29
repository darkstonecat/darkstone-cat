import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import path from 'node:path'

// Server-side tests must run without a DOM so they see the real runtime.
const NODE_TESTS = [
  'tests/server/**/*.test.{ts,tsx}',
  'tests/lib/**/*.test.{ts,tsx}',
  'tests/integration/**/*.test.{ts,tsx}',
]

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    env: loadEnv('test', process.cwd(), ''),
    projects: [
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: NODE_TESTS,
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: NODE_TESTS,
        },
      },
    ],
  },
})
