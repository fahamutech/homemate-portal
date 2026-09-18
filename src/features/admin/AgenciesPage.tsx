import {useState} from 'react';
import type {FormEvent} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import type {AdminOrganization} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {useListFilters} from '../../hooks/useListFilters';
import {
  Button, Card, ConfirmDialog, DataTable, DetailGrid, Field, FilterBar, Modal,
  PageSection, Pagination, RowActions, Select, StatusBadge, TextInput, humanise, fieldStyles,
} from '../../components/ui';
import {useAdminSearch} from './searchContext';

const STATUSES = [
  {value: 'pending', label: 'Pending'},
  {value: 'active', label: 'Active'},
  {value: 'suspended', label: 'Suspended'},
  {value: 'rejected', label: 'Rejected'},
];

const TYPES = [
  {value: 'agency', label: 'Agency'},
  {value: 'developer', label: 'Developer'},
  {value: 'institution', label: 'Institution'},
];

type Decision = {organization: AdminOrganization; status: string};

/** Agency / developer / institution registry and approval queue. */
export function AgenciesPage() {
  const api = useAdminApi();
  const {filters, setFilter, offset, setOffset, key, limit} = useListFilters({status: '', type: ''});
  const searchTerm = useAdminSearch('Name, registration number or email');
  const [creating, setCreating] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [detail, setDetail] = useState<AdminOrganization | null>(null);
  const [editing, setEditing] = useState<AdminOrganization | null>(null);

  const {state, refresh} = useResource(
    () => api.listOrganizations({...filters, query: searchTerm || undefined, limit, offset}),
    `${searchTerm}-${key}`
  );
  const rows = state.data?.items ?? [];

  return (
    <PageSection
      title="Agencies & organizations"
      description="Approve new agencies, monitor their inventory and suspend bad actors."
      actions={<Button onClick={() => setCreating(true)}>Register organization</Button>}
    >
      <Card>
        <FilterBar>
          <Field label="Status" htmlFor="agency-status">
            <Select
              id="agency-status"
              placeholder="All statuses"
              options={STATUSES}
              value={filters.status}
              onChange={(event) => setFilter('status', event.target.value)}
            />
          </Field>
          <Field label="Type" htmlFor="agency-type">
            <Select
              id="agency-type"
              placeholder="All types"
              options={TYPES}
              value={filters.type}
              onChange={(event) => setFilter('type', event.target.value)}
            />
          </Field>
        </FilterBar>
      </Card>

      <Card>
        <DataTable<AdminOrganization>
          status={state.status}
          error={state.status === 'error' ? state.error : undefined}
          onRetry={refresh}
          rows={rows}
          emptyMessage="No organizations match these filters."
          columns={[
            {key: 'name', header: 'Name', render: (org) => org.name},
            {key: 'type', header: 'Type', render: (org) => humanise(org.type)},
            {key: 'registration', header: 'Registration', render: (org) => org.registration_number ?? '—'},
            {key: 'members', header: 'Members', render: (org) => String(org.member_count)},
            {key: 'properties', header: 'Listings', render: (org) => String(org.property_count)},
            {key: 'status', header: 'Status', render: (org) => <StatusBadge status={org.status} />},
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (org) => (
                <RowActions>
                  <Button variant="ghost" size="small" onClick={() => setDetail(org)}>View</Button>
                  <Button variant="ghost" size="small" onClick={() => setEditing(org)}>Edit</Button>
                  {org.status === 'pending' && (
                    <>
                      <Button variant="outline" size="small" onClick={() => setDecision({organization: org, status: 'active'})}>
                        Approve
                      </Button>
                      <Button variant="outline" size="small" onClick={() => setDecision({organization: org, status: 'rejected'})}>
                        Reject
                      </Button>
                    </>
                  )}
                  {org.status === 'active' && (
                    <Button variant="outline" size="small" onClick={() => setDecision({organization: org, status: 'suspended'})}>
                      Suspend
                    </Button>
                  )}
                  {org.status === 'suspended' && (
                    <Button variant="outline" size="small" onClick={() => setDecision({organization: org, status: 'active'})}>
                      Restore
                    </Button>
                  )}
                </RowActions>
              ),
            },
          ]}
        />
        {state.data && (
          <Pagination total={state.data.pagination.total} limit={limit} offset={offset} onChange={setOffset} />
        )}
      </Card>

      {(creating || editing) && (
        <OrganizationFormModal
          key={editing?.id ?? 'new'}
          organization={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            refresh();
          }}
        />
      )}

      {decision && (
        <DecisionDialog
          decision={decision}
          onClose={() => setDecision(null)}
          onDone={() => {
            setDecision(null);
            refresh();
          }}
        />
      )}

      {detail && (
        <Modal
          title={detail.name}
          description={humanise(detail.type)}
          onClose={() => setDetail(null)}
          footer={<Button variant="outline" onClick={() => setDetail(null)}>Close</Button>}
        >
          <DetailGrid
            items={[
              {label: 'Status', value: <StatusBadge status={detail.status} />},
              {label: 'Registration', value: detail.registration_number ?? '—'},
              {label: 'Email', value: detail.email ?? '—'},
              {label: 'Phone', value: detail.phone_number ?? '—'},
              {label: 'Members', value: String(detail.member_count)},
              {label: 'Listings', value: String(detail.property_count)},
              {label: 'Verified by', value: detail.verified_by ?? '—'},
              {label: 'Rejection reason', value: detail.rejection_reason ?? '—'},
            ]}
          />
        </Modal>
      )}
    </PageSection>
  );
}

/**
 * Registering and correcting an organization use the same fields, so they use
 * the same form. Only the verb differs: without `organization` it registers a
 * new one (which the database starts as pending), with it, it edits in place.
 */
function OrganizationFormModal({
  organization,
  onClose,
  onSaved,
}: {
  organization?: AdminOrganization;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useAdminApi();
  const [form, setForm] = useState({
    name: organization?.name ?? '',
    type: organization?.type ?? 'agency',
    registrationNumber: organization?.registration_number ?? '',
    email: organization?.email ?? '',
    phoneNumber: organization?.phone_number ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (organization) await api.updateOrganization(organization.id, form);
      else await api.createOrganization(form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this organization');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={organization ? `Edit ${organization.name}` : 'Register an organization'}
      description={organization ? undefined : 'New organizations start pending until approved.'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className={fieldStyles.modalBody}>
        {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}
        <Field label="Name" htmlFor="org-name">
          <TextInput id="org-name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
        </Field>
        <Field label="Type" htmlFor="org-type">
          <Select id="org-type" options={TYPES} value={form.type} onChange={(e) => setForm({...form, type: e.target.value})} />
        </Field>
        <Field label="Registration number" htmlFor="org-reg">
          <TextInput
            id="org-reg"
            placeholder="BRELA-…"
            value={form.registrationNumber}
            onChange={(e) => setForm({...form, registrationNumber: e.target.value})}
          />
        </Field>
        <Field label="Email" htmlFor="org-email">
          <TextInput id="org-email" type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
        </Field>
        <Field label="Phone" htmlFor="org-phone">
          <TextInput id="org-phone" value={form.phoneNumber} onChange={(e) => setForm({...form, phoneNumber: e.target.value})} />
        </Field>
        <div className={fieldStyles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : organization ? 'Save changes' : 'Register'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DecisionDialog({
  decision,
  onClose,
  onDone,
}: {
  decision: Decision;
  onClose: () => void;
  onDone: () => void;
}) {
  const api = useAdminApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rejecting = decision.status === 'rejected';

  const labels: Record<string, {title: string; confirm: string; description: string}> = {
    active: {
      title: `Approve ${decision.organization.name}?`,
      confirm: 'Approve',
      description: 'They will be able to operate on the platform. The approval is recorded against your account.',
    },
    rejected: {
      title: `Reject ${decision.organization.name}?`,
      confirm: 'Reject',
      description: 'The reason is stored with the application and shown in the audit trail.',
    },
    suspended: {
      title: `Suspend ${decision.organization.name}?`,
      confirm: 'Suspend',
      description: 'Their listings stay in place but the organization is blocked immediately.',
    },
  };

  const copy = labels[decision.status];

  async function confirm(reason: string) {
    setBusy(true);
    setError(null);
    try {
      await api.changeOrganizationStatus(decision.organization.id, {
        status: decision.status,
        reason: reason || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this organization');
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirm}
      destructive={rejecting || decision.status === 'suspended'}
      reasonLabel={rejecting ? 'Rejection reason' : undefined}
      reasonRequired={rejecting}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
