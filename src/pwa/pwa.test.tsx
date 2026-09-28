import {afterEach, describe, expect, test, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {currentInstallMethod, isNewerBuild} from './pwa';
import {InstallAppButton} from './InstallAppButton';
import {UpdateBanner} from './UpdateBanner';

type Pwa = NonNullable<Window['hmPwa']>;

function stubPwa(overrides: Partial<Pwa> = {}): Pwa {
  const pwa: Pwa = {
    isIos: false,
    isMobile: false,
    isStandalone: () => false,
    canPrompt: () => false,
    prompt: vi.fn(async () => 'accepted' as const),
    ...overrides,
  };
  window.hmPwa = pwa;
  return pwa;
}

afterEach(() => {
  delete window.hmPwa;
  vi.unstubAllGlobals();
});

describe('currentInstallMethod', () => {
  test('follows what the browser offers', () => {
    expect(currentInstallMethod(undefined)).toBe('none');
    expect(currentInstallMethod(stubPwa({canPrompt: () => true}))).toBe('prompt');
    expect(currentInstallMethod(stubPwa({isIos: true, isMobile: true}))).toBe('ios');
    expect(currentInstallMethod(stubPwa({isMobile: true}))).toBe('menu');
    // Desktop Firefox or Safari: no install path worth describing.
    expect(currentInstallMethod(stubPwa())).toBe('none');
  });

  test('an installed portal offers nothing', () => {
    expect(currentInstallMethod(stubPwa({isStandalone: () => true, canPrompt: () => true}))).toBe('none');
  });
});

describe('isNewerBuild', () => {
  test('only a strictly higher deployed build is newer', () => {
    expect(isNewerBuild({build: 12}, 11)).toBe(true);
    expect(isNewerBuild({build: 11}, 11)).toBe(false);
    expect(isNewerBuild({build: 10}, 11)).toBe(false);
  });

  test('a local build or a broken file never nags', () => {
    expect(isNewerBuild({build: 99}, 0)).toBe(false);
    expect(isNewerBuild({build: 'x'}, 11)).toBe(false);
    expect(isNewerBuild(null, 11)).toBe(false);
    expect(isNewerBuild('<!doctype html>', 11)).toBe(false);
  });
});

describe('InstallAppButton', () => {
  test('is absent where the portal cannot be installed', () => {
    stubPwa();
    render(<InstallAppButton />);
    expect(screen.queryByRole('button', {name: /install app/i})).not.toBeInTheDocument();
  });

  test('opens the browser dialog in Chrome', async () => {
    const pwa = stubPwa({canPrompt: () => true});
    render(<InstallAppButton />);
    await userEvent.click(screen.getByRole('button', {name: /install app/i}));
    expect(pwa.prompt).toHaveBeenCalledOnce();
  });

  test('explains Share → Add to Home Screen on an iPhone', async () => {
    stubPwa({isIos: true, isMobile: true});
    render(<InstallAppButton />);
    await userEvent.click(screen.getByRole('button', {name: /install app/i}));

    expect(screen.getByRole('dialog', {name: /add the portal to your home screen/i})).toBeInTheDocument();
    expect(screen.getByText(/share button/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Done'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('UpdateBanner', () => {
  test('stays hidden while the deployed build is the running one', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({build: 7})));
    vi.stubGlobal('fetch', fetch);
    render(<UpdateBanner currentBuild={7} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('offers a reload once a newer build is live, and can be dismissed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({build: 8}))));
    render(<UpdateBanner currentBuild={7} />);

    expect(await screen.findByText('A new version of the portal is available.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Reload'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Dismiss'}));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('a local build never asks the server', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<UpdateBanner currentBuild={0} />);
    expect(fetch).not.toHaveBeenCalled();
  });
});
