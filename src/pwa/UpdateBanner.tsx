import {useState} from 'react';
import {useNewerVersion} from './pwa';
import styles from './pwa.module.css';

/** A bottom-right notice once a newer portal build is deployed. Mounted once, at the root. */
export function UpdateBanner({currentBuild}: {currentBuild?: number}) {
  const newer = useNewerVersion(currentBuild);
  const [dismissed, setDismissed] = useState(false);
  if (!newer || dismissed) return null;

  return (
    <div className={styles.updateBanner} role="status">
      <span>A new version of the portal is available.</span>
      <button type="button" className={styles.updateAction} onClick={() => window.location.reload()}>
        Reload
      </button>
      <button
        type="button"
        className={styles.updateClose}
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
      >
        ×
      </button>
    </div>
  );
}
