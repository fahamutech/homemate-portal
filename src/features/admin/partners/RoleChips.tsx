import type {UserRole} from '../../../api/adminApi';
import {StatusBadge, fieldStyles} from '../../../components/ui';
import {ROLE_LABEL, ROLE_STATUS_LABEL} from './labels';

/** A person's roles (T01) as chips: "Landlord · Active", "Broker · Suspended". */
export function RoleChips({roles}: {roles: UserRole[] | undefined}) {
  if (!roles?.length) return <span>—</span>;
  return (
    <span className={fieldStyles.inlineStack}>
      {roles.map((r) => (
        <StatusBadge key={r.role} status={r.status} label={`${ROLE_LABEL[r.role]} · ${ROLE_STATUS_LABEL[r.status]}`} />
      ))}
    </span>
  );
}
