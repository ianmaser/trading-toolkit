import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [['__tests__/hooks/**', 'happy-dom']],
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      include: ['services/**', 'hooks/**', 'app/api/**'],
      exclude: ['node_modules', '.next'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
