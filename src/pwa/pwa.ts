import {useCallback, useEffect, useState} from 'react';

/**
 * How this browser lets someone install the portal:
 * - `prompt`: Chrome/Edge/Samsung — the browser's own dialog.
 * - `ios`: Safari on iPhone/iPad — Share → Add to Home Screen, shown as steps.
 * - `menu`: a mobile browser that did not offer its dialog — steps via its menu.
 * - `none`: already installed, or a browser with no install path.
 */
export type InstallMethod = 'prompt' | 'ios' | 'menu' | 'none';

export function currentInstallMethod(pwa = window.hmPwa): InstallMethod {
  if (!pwa || pwa.isStandalone()) return 'none';
  if (pwa.canPrompt()) return 'prompt';
  if (pwa.isIos) return 'ios';
  return pwa.isMobile ? 'menu' : 'none';
}

/** The install method, kept current as the browser becomes ready or the app is installed. */
export function usePwaInstall() {
  const [method, setMethod] = useState<InstallMethod>(() => currentInstallMethod());

  useEffect(() => {
    const refresh = () => setMethod(currentInstallMethod());
    window.addEventListener('hm-pwa-change', refresh);
    return () => window.removeEventListener('hm-pwa-change', refresh);
  }, []);

  const prompt = useCallback(async () => {
    const outcome = (await window.hmPwa?.prompt()) ?? 'unavailable';
    setMethod(currentInstallMethod());
    return outcome === 'accepted';
  }, []);

  return {method, prompt};
}

/** Whether the deployed version.json describes a newer build than the running one. */
export function isNewerBuild(versionJson: unknown, currentBuild: number): boolean {
  if (currentBuild <= 0 || typeof versionJson !== 'object' || versionJson === null) return false;
  const deployed = Number((versionJson as {build?: unknown}).build);
  return Number.isFinite(deployed) && deployed > currentBuild;
}

const POLL_MS = 30 * 60 * 1000;

/**
 * True once a newer deploy is live. Checks on load, every half hour, and
 * whenever the tab comes back into view. It never reloads by itself: a
 * half-filled listing form is worth more than being current a minute sooner,
 * so the banner asks instead.
 */
export function useNewerVersion(currentBuild: number = __APP_BUILD__, pollMs = POLL_MS): boolean {
  const [newer, setNewer] = useState(false);

  useEffect(() => {
    if (currentBuild <= 0 || newer) return;
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {cache: 'no-store'});
        if (!response.ok) return;
        if (!cancelled && isNewerBuild(await response.json(), currentBuild)) setNewer(true);
      } catch {
        // Offline or mid-deploy: the next check will tell.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    void check();
    const timer = pollMs > 0 ? window.setInterval(check, pollMs) : undefined;
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentBuild, newer, pollMs]);

  return newer;
}
