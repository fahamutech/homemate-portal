import '@testing-library/jest-dom/vitest'
import {afterEach} from 'vitest'
import {cleanup} from '@testing-library/react'

// `globals: false` in vite.config.ts keeps describe/test/expect out of the
// global namespace on purpose, so RTL's own auto-cleanup (which only
// activates when it detects a global `afterEach`) never fires — wire it up
// explicitly instead of flipping `globals: true` for the whole suite.
afterEach(() => {
  cleanup()
})
