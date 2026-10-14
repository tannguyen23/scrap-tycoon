import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const layer = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@core': layer('./src/core'),
      '@ground': layer('./src/ground'),
      '@scenery': layer('./src/scenery'),
      '@domain': layer('./src/domain'),
      '@content': layer('./src/content'),
      '@ui': layer('./src/ui'),
      '@platform': layer('./src/platform'),
      '@i18n': layer('./src/i18n'),
      '@app': layer('./src/app'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
