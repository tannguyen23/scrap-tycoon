import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config.ts'

/**
 * Dev-only asset studio: same project, its own port and cache dir so it can run
 * next to `npm run dev` (game on 5173, studio on 5180).
 */
export default mergeConfig(
  base,
  defineConfig({
    cacheDir: 'node_modules/.vite-studio',
    server: { port: 5180, strictPort: true, open: '/studio.html' },
  }),
)