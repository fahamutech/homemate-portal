import type {AdminNavItem} from './navConfig';

/**
 * The real Figma file defines a bespoke `.icon/*` symbol per nav item
 * (hand-drawn from small rectangles/ellipses — 17+ of them across the
 * component library). Reproducing every one pixel-for-pixel was out of
 * scope for this pass; these are clean, semantically-equivalent stand-ins
 * (currentColor stroke icons) so the sidebar is complete and maintainable
 * now. Swap for the real exported icon set when it's prioritized.
 */
const ICON_PATHS: Record<AdminNavItem['icon'], string> = {
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  staff: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  properties: 'M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z',
  brokers: 'M8 12h8M12 8v8M4 21h16a1 1 0 0 0 1-1V8l-5-5H8L3 8v12a1 1 0 0 0 1 1Z',
  payments: 'M2 7h20v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1ZM2 10h20M6 15h4',
  reports: 'M4 21V10M12 21V3M20 21v-7',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM3 12h2M19 12h2M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4',
  content: 'M4 3h12l4 4v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM16 3v4h4M8 13h8M8 17h8M8 9h3',
};

export function AdminNavIcon({icon, className}: {icon: AdminNavItem['icon']; className?: string}) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICON_PATHS[icon]} />
    </svg>
  );
}
