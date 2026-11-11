/**
 * Everything that differs between a laptop and the deployed portal.
 *
 * Mirrors homemate-mobile's `lib/core/config/env.dart`: a production build
 * that nobody explicitly pointed elsewhere must reach the deployed backend
 * rather than `localhost`, even if a local `.env`/`.env.local` still says
 * otherwise when `vite build` runs. Neither file is committed; see
 * `.env.example`.
 */

const PRODUCTION_API_BASE_URL = 'https://homemate-faas.bfast.smartstock.co.tz';
const DEVELOPMENT_API_BASE_URL = 'http://localhost:3001';

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL =
  configuredApiBaseUrl ?? (import.meta.env.PROD ? PRODUCTION_API_BASE_URL : DEVELOPMENT_API_BASE_URL);

/** True when the portal is talking to the deployed backend. */
export const isProduction = API_BASE_URL === PRODUCTION_API_BASE_URL;
