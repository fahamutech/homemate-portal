import {useEffect, useState} from 'react';
import type {ButtonHTMLAttributes, FormEvent, ReactNode} from 'react';
import styles from './ui.module.css';

/* --- Button ---------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.buttonPrimary,
  secondary: styles.buttonSecondary,
  outline: styles.buttonOutline,
  ghost: styles.buttonGhost,
  danger: styles.buttonDanger,
};

export function Button({
  variant = 'primary',
  size = 'medium',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {variant?: ButtonVariant; size?: 'medium' | 'small'}) {
  const sizeClass = size === 'small' ? styles.buttonSmall : styles.buttonMedium;
  return <button {...props} className={`${styles.button} ${sizeClass} ${VARIANT_CLASS[variant]} ${className}`} />;
}

/* --- Badge ----------------------------------------------------------------- */

/**
 * Status vocabulary is shared across users, organizations and properties, so
 * the colour mapping lives here once rather than in each screen.
 */
const STATUS_TONE: Record<string, string> = {
  active: styles.badgeSuccess,
  approved: styles.badgeSuccess,
  pending: styles.badgeWarning,
  pending_review: styles.badgeWarning,
  changes_requested: styles.badgeWarning,
  draft: styles.badgeNeutral,
  archived: styles.badgeNeutral,
  deactivated: styles.badgeNeutral,
  suspended: styles.badgeDanger,
  rejected: styles.badgeDanger,
  verified: styles.badgeSuccess,
  confirmed: styles.badgeSuccess,
  awaiting_payment: styles.badgeWarning,
  awaiting_verification: styles.badgeWarning,
  paid: styles.badgeSuccess,
  // partner roles (T01/T03) and landlord confirmation (T04)
  in_review: styles.badgeWarning,
  applied: styles.badgeNeutral,
  invited: styles.badgeNeutral,
  action_needed: styles.badgeWarning,
  disputed: styles.badgeDanger,
  not_required: styles.badgeNeutral,
};

export function humanise(value: string | null | undefined) {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A status pill, toned by its value; `label` overrides the humanised text. */
export function StatusBadge({status, label}: {status: string | null; label?: string}) {
  if (!status) return <span>—</span>;
  return (
    <span className={`${styles.badge} ${STATUS_TONE[status] ?? styles.badgeNeutral}`}>{label ?? humanise(status)}</span>
  );
}

/* --- Fields ---------------------------------------------------------------- */

export function Field({
  label,
  htmlFor,
  error,
  children,
  className = '',
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${styles.field} ${className}`}>
      <label className={styles.label} htmlFor={htmlFor}>{label}</label>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={styles.input} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={styles.textarea} />;
}

export function Select({
  options,
  placeholder,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: {value: string; label: string}[];
  placeholder?: string;
}) {
  return (
    <select {...props} className={styles.select}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

/* --- Page scaffolding ------------------------------------------------------ */

export function PageSection({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.page}>
      {(title || actions) && (
        <header className={styles.pageHeader}>
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Card({children, className = ''}: {children: ReactNode; className?: string}) {
  return <div className={`${styles.card} ${className}`}>{children}</div>;
}

export function FilterBar({children}: {children: ReactNode}) {
  return <div className={styles.filterBar}>{children}</div>;
}

export const fieldStyles = styles;

/* --- Table ----------------------------------------------------------------- */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
}

/**
 * One table for every list screen. Covers the loading, empty and error states
 * the UI/UX spec requires, and collapses to labelled cards under 768px (the
 * `data-label` attributes drive the mobile layout in ui.module.css).
 */
export function DataTable<T extends {id: string}>({
  columns,
  rows,
  status,
  error,
  emptyMessage = 'Nothing to show yet.',
  onRetry,
}: {
  columns: Column<T>[];
  rows: T[];
  status: 'loading' | 'ready' | 'error';
  error?: string;
  emptyMessage?: string;
  onRetry?: () => void;
}) {
  if (status === 'error') {
    return (
      <div>
        <div className={styles.errorBlock} role="alert">{error ?? 'Could not load this list.'}</div>
        {onRetry && (
          <div className={styles.stateBlock}>
            <Button variant="outline" size="small" onClick={onRetry}>Try again</Button>
          </div>
        )}
      </div>
    );
  }

  if (status === 'loading' && rows.length === 0) {
    return (
      <div aria-busy="true" aria-label="Loading">
        {[0, 1, 2, 3].map((index) => <div key={index} className={styles.skeletonRow} />)}
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className={styles.stateBlock}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={column.align === 'right' ? {textAlign: 'right'} : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={column.header}
                  style={column.align === 'right' ? {textAlign: 'right'} : undefined}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RowActions({children}: {children: ReactNode}) {
  return <div className={styles.rowActions}>{children}</div>;
}

/* --- Pagination ------------------------------------------------------------ */

export function Pagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (nextOffset: number) => void;
}) {
  if (total === 0) return null;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div className={styles.pagination}>
      <span className={styles.paginationInfo}>Showing {from}–{to} of {total}</span>
      <div className={styles.paginationControls}>
        <Button variant="outline" size="small" disabled={offset === 0} onClick={() => onChange(Math.max(offset - limit, 0))}>
          Previous
        </Button>
        <Button variant="outline" size="small" disabled={to >= total} onClick={() => onChange(offset + limit)}>
          Next
        </Button>
      </div>
    </div>
  );
}

/* --- Modal & dialogs -------------------------------------------------------- */

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.modal}>
        <header className={styles.modalHeader}>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </header>
        <div className={styles.modalBody}>{children}</div>
        {footer && <footer className={styles.modalFooter}>{footer}</footer>}
      </div>
    </div>
  );
}

/**
 * Confirm dialog with an optional required reason — the shape every
 * destructive/moderation action in the backoffice needs (suspend a user,
 * reject an agency, request changes on a listing).
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  reasonLabel,
  reasonRequired = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  reasonLabel?: string;
  reasonRequired?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const missingReason = reasonRequired && reason.trim().length === 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (missingReason) return;
    onConfirm(reason.trim());
  }

  return (
    <Modal title={title} description={description} onClose={onCancel}>
      <form onSubmit={handleSubmit} className={styles.modalBody}>
        {error && <div className={styles.errorBlock} role="alert">{error}</div>}
        {reasonLabel && (
          <Field label={reasonLabel} htmlFor="confirm-reason" error={touched && missingReason ? 'A reason is required' : null}>
            <TextArea
              id="confirm-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
            />
          </Field>
        )}
        <div className={styles.modalFooter}>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button type="submit" variant={destructive ? 'danger' : 'primary'} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* --- Detail list ----------------------------------------------------------- */

export function DetailGrid({items}: {items: {label: string; value: ReactNode}[]}) {
  return (
    <dl className={styles.detailGrid}>
      {items.map((item) => (
        <div key={item.label} className={styles.detailItem}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
