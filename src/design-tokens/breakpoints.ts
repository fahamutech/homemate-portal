/**
 * Mirrors the CSS custom properties in tokens.css for use in JS/TS logic
 * (e.g. matchMedia checks). Keep in sync with tokens.css by hand until a
 * build-time token generator is introduced — see tokens.css's provenance
 * note for why these are still partly provisional.
 */
export const breakpoints = {
  mobile: 375,
  tablet: 768,
  desktop: 1440,
} as const;
