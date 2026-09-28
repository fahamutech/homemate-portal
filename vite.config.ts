/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import {defineConfig, type Plugin} from 'vite'

// CI passes APP_BUILD_NUMBER (the run number); a local build is 0, which
// switches the "newer version available" check off — there is nothing
// deployed to compare a laptop build against.
const appBuild = Number(process.env.APP_BUILD_NUMBER ?? 0) || 0

/** Writes dist/version.json, which open tabs poll to notice a newer deploy. */
function versionFile(): Plugin {
  return {
    name: 'homemate-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({type: 'asset', fileName: 'version.json', source: JSON.stringify({build: appBuild})})
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionFile()],
  define: {
    __APP_BUILD__: JSON.stringify(appBuild),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
  },
})
