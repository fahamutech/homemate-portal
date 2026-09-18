import styles from './PlaceholderPage.module.css';

/**
 * Real routing/navigation exists for every admin section from day one; the
 * screens themselves (ADM-EXT-002..008 in Figma) land in later phases per
 * IMPLEMENTATION_PLAN.md. This keeps the sidebar honest about what's built
 * vs. what's next, rather than hiding unbuilt sections entirely.
 */
export function PlaceholderPage({title}: {title: string}) {
  return (
    <div className={styles.page}>
      <h2>{title}</h2>
      <p>This section is planned for a later phase — see IMPLEMENTATION_PLAN.md.</p>
    </div>
  );
}
