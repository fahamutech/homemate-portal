/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** The CI run that built this bundle; 0 for a local build. See vite.config.ts. */
declare const __APP_BUILD__: number;

/** Set up by index.html before the bundle loads. See src/pwa/pwa.ts. */
interface Window {
  hmPwa?: {
    isIos: boolean;
    isMobile: boolean;
    isStandalone(): boolean;
    canPrompt(): boolean;
    prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'>;
  };
}
