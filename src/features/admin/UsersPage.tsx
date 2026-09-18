import {useState} from 'react';
import type {FormEvent} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import type {AdminUser} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {useListFilters} from '../../hooks/useListFilters';
import {
  Button, Card, ConfirmDialog, DataTable, Field, FilterBar, Modal,
  PageSection, Pagination, RowActions, Select, StatusBadge, TextInput, humanise, fieldStyles,
} from '../../components/ui';
import {useAdminSearch} from './searchContext';
import {useAttention} from './attentionContext';
import {UserDetailModal} from './UserDetailModal';

const PLATFORM_ROLES = [
  {value: 'customer', label: 'Customer'},
  {value: 'landlord', label: 'Landlord'},
  {value: 'agency', label: 'Agency'},
  {value: 'broker', label: 'Broker'},
];

const STAFF_ROLES = [
  {value: 'moderator', label: 'Moderator'},
  {value: 'manager', label: 'Manager'},
  {value: 'finance_auditor', label: 'Finance Auditor'},
  {value: 'admin', label: 'Administrator'},
];

const KYC_STATUSES = [
  {value: 'not_started', label: 'Not started'},
  {value: 'pending', label: 'Pending'},
  {value: 'in_review', label: 'In review'},
  {value: 'verified', label: 'Verified'},
  {value: 'rejected', label: 'Rejected'},
  {value: 'expired', label: 'Expired'},
];

const STATUSES = [
  {value: 'active', label: 'Active'},
  {value: 'pending', label: 'Pending'},
  {value: 'suspended', label: 'Suspended'},
  {value: 'deactivated', label: 'Deactivated'},
];

type StatusAction = {user: AdminUser; status: string};

/**
 * One screen serves both "Users" (customers, landlords, agencies, brokers)
 * and "Staff" (moderators, managers, finance auditors, admins): the two
 * differ only in which roles they offer and which identifier column matters,
 * so they are configuration here rather than a second near-identical page.
 */
export function UsersPage({staffOnly}: {staffOnly: boolean}) {
  const api = useAdminApi();
  const roles = staffOnly ? STAFF_ROLES : PLATFORM_ROLES;
  const {filters, setFilter, offset, setOffset, key, limit} = useListFilters({
    role: '', status: '', kycStatus: '', needsAttention: '',
  });
  const searchTerm = useAdminSearch(
    staffOnly ? 'Name, email or ID number' : 'Name, phone, email or ID number'
  );
  const attention = useAttention();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const {state, refresh} = useResource(
    () => api.listUsers({...filters, query: searchTerm || undefined, staffOnly, limit, offset}),
    `${staffOnly}-${searchTerm}-${key}`
  );

  const rows = state.data?.items ?? [];

  return (
    <PageSection
      title={staffOnly ? 'Backoffice staff' : 'Platform users'}
      description={
        staffOnly
          ? 'Moderators, managers, finance auditors and administrators.'
          : 'Customers, landlords, agencies and brokers registered on the platform.'
      }
      actions={<Button onClick={() => setCreating(true)}>{staffOnly ? 'Invite staff' : 'Add user'}</Button>}
    >
      <Card>
        <FilterBar>
          <Field label="Role" htmlFor="user-role">
            <Select
              id="user-role"
              placeholder="All roles"
              options={roles}
              value={filters.role}
              onChange={(event) => setFilter('role', event.target.value)}
            />
          </Field>
          <Field label="Status" htmlFor="user-status">
            <Select
              id="user-status"
              placeholder="All statuses"
              options={STATUSES}
              value={filters.status}
              onChange={(event) => setFilter('status', event.target.value)}
            />
          </Field>
          <Field label="Identity" htmlFor="user-kyc-status">
            <Select
              id="user-kyc-status"
              placeholder="Any identity state"
              options={KYC_STATUSES}
              value={filters.kycStatus}
              onChange={(event) => setFilter('kycStatus', event.target.value)}
            />
          </Field>
          <Field label="Attention" htmlFor="user-attention">
            <Select
              id="user-attention"
              placeholder="Everyone"
              options={[{value: 'true', label: 'Needs attention'}]}
              value={filters.needsAttention}
              onChange={(event) => setFilter('needsAttention', event.target.value)}
            />
          </Field>
        </FilterBar>
      </Card>

      <Card>
        <DataTable<AdminUser>
          status={state.status}
          error={state.status === 'error' ? state.error : undefined}
          onRetry={refresh}
          rows={rows}
          emptyMessage={staffOnly ? 'No staff match these filters.' : 'No users match these filters.'}
          columns={[
            {key: 'name', header: 'Name', render: (user) => user.full_name ?? '—'},
            {
              key: 'contact',
              header: staffOnly ? 'Email' : 'Phone',
              render: (user) => (staffOnly ? user.email : user.phone_number) ?? '—',
            },
            {key: 'role', header: 'Role', render: (user) => humanise(user.role)},
            ...(staffOnly
              ? [{key: 'job', header: 'Job title', render: (user: AdminUser) => user.job_title ?? '—'}]
              : [{key: 'org', header: 'Organization', render: (user: AdminUser) => user.organization_name ?? '—'}]),
            {key: 'status', header: 'Status', render: (user) => <StatusBadge status={user.status} />},
            {
              key: 'kyc',
              header: 'Identity',
              render: (user) => (
                <span className={fieldStyles.inlineStack}>
                  <StatusBadge status={user.kyc_status ?? 'not_started'} />
                  {/* the two things that actually need a person, shown where
                      they are decided rather than only in the sidebar count */}
                  {Number(user.documents_pending ?? 0) > 0 && (
                    <span title="Documents awaiting review">{user.documents_pending} to review</span>
                  )}
                  {Number(user.open_remediations ?? 0) > 0 && (
                    <span title="Open remediations">{user.open_remediations} open</span>
                  )}
                </span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (user) => (
                <RowActions>
                  <Button variant="ghost" size="small" onClick={() => setDetailId(user.id)}>View</Button>
                  <Button variant="ghost" size="small" onClick={() => setEditing(user)}>Edit</Button>
                  {user.status === 'suspended' || user.status === 'pending' || user.status === 'deactivated' ? (
                    <Button variant="outline" size="small" onClick={() => setStatusAction({user, status: 'active'})}>
                      Activate
                    </Button>
                  ) : (
                    <Button variant="outline" size="small" onClick={() => setStatusAction({user, status: 'suspended'})}>
                      Suspend
                    </Button>
                  )}
                </RowActions>
              ),
            },
          ]}
        />
        {state.data && (
          <Pagination
            total={state.data.pagination.total}
            limit={limit}
            offset={offset}
            onChange={setOffset}
          />
        )}
      </Card>

      {creating && (
        <CreateUserModal
          staffOnly={staffOnly}
          roles={roles}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}

      {statusAction && (
        <StatusActionDialog
          action={statusAction}
          onClose={() => setStatusAction(null)}
          onDone={() => {
            setStatusAction(null);
            refresh();
          }}
        />
      )}

      {editing && (
        <EditUserModal
          user={editing}
          staffOnly={staffOnly}
          roles={roles}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      {detailId && (
        <UserDetailModal
          userId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => {
            refresh();
            // a verification or a closed remediation changes the sidebar count
            attention.refresh();
          }}
        />
      )}
    </PageSection>
  );
}

/**
 * Correcting the account itself — the name, how to reach them, what they are.
 * Identity evidence is edited in the detail modal instead: fixing a typo in a
 * name and changing what identity HomeMate has verified are different acts
 * with different consequences, and merging them invites the second by
 * accident.
 */
function EditUserModal({
  user,
  staffOnly,
  roles,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  staffOnly: boolean;
  roles: {value: string; label: string}[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useAdminApi();
  const [form, setForm] = useState({
    fullName: user.full_name ?? '',
    phoneNumber: user.phone_number ?? '',
    email: user.email ?? '',
    role: user.role,
    jobTitle: user.job_title ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.updateUser(user.id, {
        fullName: form.fullName,
        phoneNumber: form.phoneNumber || undefined,
        email: form.email,
        role: form.role,
        jobTitle: staffOnly ? form.jobTitle : undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this user');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Edit ${user.full_name ?? 'user'}`}
      description="Account details. Identity evidence is edited under View."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className={fieldStyles.modalBody}>
        {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}
        <Field label="Full name" htmlFor="edit-name">
          <TextInput
            id="edit-name"
            value={form.fullName}
            onChange={(event) => setForm({...form, fullName: event.target.value})}
            required
          />
        </Field>
        <Field label="Role" htmlFor="edit-role">
          <Select
            id="edit-role"
            options={roles}
            value={form.role}
            onChange={(event) => setForm({...form, role: event.target.value})}
          />
        </Field>
        <Field label="Phone number" htmlFor="edit-phone">
          <TextInput
            id="edit-phone"
            value={form.phoneNumber}
            onChange={(event) => setForm({...form, phoneNumber: event.target.value})}
          />
        </Field>
        <Field label="Email address" htmlFor="edit-email">
          <TextInput
            id="edit-email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({...form, email: event.target.value})}
          />
        </Field>
        {staffOnly && (
          <Field label="Job title" htmlFor="edit-job">
            <TextInput
              id="edit-job"
              value={form.jobTitle}
              onChange={(event) => setForm({...form, jobTitle: event.target.value})}
            />
          </Field>
        )}
        <div className={fieldStyles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateUserModal({
  staffOnly,
  roles,
  onClose,
  onCreated,
}: {
  staffOnly: boolean;
  roles: {value: string; label: string}[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const api = useAdminApi();
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    role: roles[0].value,
    jobTitle: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createUser({
        fullName: form.fullName,
        phoneNumber: form.phoneNumber || undefined,
        email: form.email || undefined,
        role: form.role,
        jobTitle: staffOnly ? form.jobTitle || undefined : undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this user');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={staffOnly ? 'Invite a staff member' : 'Add a platform user'}
      description={staffOnly ? 'Staff start as pending until their account is activated.' : undefined}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className={fieldStyles.modalBody}>
        {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}
        <Field label="Full name" htmlFor="create-name">
          <TextInput
            id="create-name"
            value={form.fullName}
            onChange={(event) => setForm({...form, fullName: event.target.value})}
            required
          />
        </Field>
        <Field label="Role" htmlFor="create-role">
          <Select
            id="create-role"
            options={roles}
            value={form.role}
            onChange={(event) => setForm({...form, role: event.target.value})}
          />
        </Field>
        {staffOnly ? (
          <>
            <Field label="Email address" htmlFor="create-email">
              <TextInput
                id="create-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({...form, email: event.target.value})}
                required
              />
            </Field>
            <Field label="Job title" htmlFor="create-job">
              <TextInput
                id="create-job"
                value={form.jobTitle}
                onChange={(event) => setForm({...form, jobTitle: event.target.value})}
              />
            </Field>
          </>
        ) : (
          <Field label="Phone number" htmlFor="create-phone">
            <TextInput
              id="create-phone"
              placeholder="+255712345678"
              value={form.phoneNumber}
              onChange={(event) => setForm({...form, phoneNumber: event.target.value})}
              required
            />
          </Field>
        )}
        <div className={fieldStyles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function StatusActionDialog({
  action,
  onClose,
  onDone,
}: {
  action: StatusAction;
  onClose: () => void;
  onDone: () => void;
}) {
  const api = useAdminApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suspending = action.status === 'suspended';

  async function confirm(reason: string) {
    setBusy(true);
    setError(null);
    try {
      await api.changeUserStatus(action.user.id, {status: action.status, reason: reason || undefined});
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this user');
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      title={suspending ? `Suspend ${action.user.full_name ?? 'user'}?` : `Activate ${action.user.full_name ?? 'user'}?`}
      description={
        suspending
          ? 'They will lose access immediately. The reason is recorded in the audit trail.'
          : 'Access will be restored and any suspension reason cleared.'
      }
      confirmLabel={suspending ? 'Suspend' : 'Activate'}
      destructive={suspending}
      reasonLabel={suspending ? 'Reason' : undefined}
      reasonRequired={suspending}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
