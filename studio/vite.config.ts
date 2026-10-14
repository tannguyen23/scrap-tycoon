import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vite'
import base from '../vite.config.ts'

/**
 * Dev-only asset studio app: the folder owns its entry and config, while the repo
 * root stays the project root so the kits' aliases, node_modules and public/
 * resolve exactly like in the game. Lifting the studio out = moving this folder
 * plus the project adapters it registers.
 */
export default mergeConfig(
  base,
  defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    publicDir: fileURLToPath(new URL('../public', import.meta.url)),
    cacheDir: fileURLToPath(new URL('../node_modules/.vite-studio', import.meta.url)),
    server: { port: 5180, strictPort: true, open: '/' },
  }),
)
