import {useState} from 'react';
import {Button, Modal} from '../components/ui';
import {usePwaInstall, type InstallMethod} from './pwa';
import styles from './pwa.module.css';

const STEPS: Record<'ios' | 'menu', {title: string; steps: string[]}> = {
  ios: {
    title: 'Add the portal to your Home Screen',
    steps: [
      'Tap the Share button in Safari: the square with an arrow pointing up.',
      'Scroll down and tap “Add to Home Screen”.',
      'Tap “Add”. The portal opens full screen from its icon.',
    ],
  },
  menu: {
    title: 'Install the portal',
    steps: [
      'Open your browser menu: ⋮ or ☰.',
      'Tap “Install app” or “Add to Home screen”.',
      'Confirm. The portal opens full screen from its icon.',
    ],
  },
};

/**
 * "Install app" for the sidebar. The browser's own dialog where it has one;
 * otherwise the steps, since on iOS only the person can do it. Renders
 * nothing once installed or where there is no way to install. `tone` is
 * `onDark` for the navy sidebar, `onLight` for a white card like the login.
 */
export function InstallAppButton({tone = 'onDark'}: {tone?: 'onDark' | 'onLight'}) {
  const {method, prompt} = usePwaInstall();
  const [steps, setSteps] = useState<Exclude<InstallMethod, 'prompt' | 'none'> | null>(null);

  if (method === 'none') return null;

  const install = () => {
    if (method === 'prompt') void prompt();
    else setSteps(method);
  };

  return (
    <>
      <button type="button" className={`${styles.installButton} ${tone === 'onLight' ? styles.installButtonLight : ''}`} onClick={install}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"
          />
        </svg>
        Install app
      </button>
      {steps && (
        <Modal
          title={STEPS[steps].title}
          onClose={() => setSteps(null)}
          footer={<Button onClick={() => setSteps(null)}>Done</Button>}
        >
          <ol className={styles.steps}>
            {STEPS[steps].steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Modal>
      )}
    </>
  );
}
