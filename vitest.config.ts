import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ['node_modules', '.worktrees/**', 'worktrees/**', 'dist'],
    environmentMatchGlobs: [
      ['src/client/**/*.test.tsx', 'jsdom'],
      ['src/client/**/*.test.ts', 'jsdom'],
    ],
    environment: 'node',
    globals: true,
    setupFiles: ['src/client/setupTests.ts'],
  },
})
