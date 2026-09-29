import {useState} from 'react';
import type {FormEvent} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import type {PartnerApplication, PartnerApplicationDocument, PartnerDecision} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {useListFilters} from '../../hooks/useListFilters';
import {
  Button, Card, ConfirmDialog, DataTable, DetailGrid, Field, FilterBar, Modal, PageSection, Pagination,
  RowActions, Select, StatusBadge, TextArea, fieldStyles,
} from '../../components/ui';
import {AuthedImage} from './AuthedImage';
import {useAdminSearch} from './searchContext';
import {useAttention} from './attentionContext';
import {
  DOCUMENT_LABEL, KYC_STATUS_LABEL, OWNERSHIP_DOCUMENTS, QUEUE_STATUSES, ROLE_LABEL, ROLE_STATUS_LABEL, STEP_LABEL,
} from './partners/labels';

/**
 * Partner applications (T08, Figma "06 Backoffice"): the people who applied
 * to be brokers or landlords from the app, with their evidence, and the
 * decision on each — approve, ask for something, or reject. Documents are
 * verified on the person's own record (Users → Documents), as for any KYC.
 */
export function PartnersPage() {
  const api = useAdminApi();
  const attention = useAttention();
  const {filters, setFilter, offset, setOffset, key, limit} = useListFilters({role: '', status: ''});
  const searchTerm = useAdminSearch('Name, phone or NIDA number');
  const [open, setOpen] = useState<PartnerApplication | null>(null);

  const {state, refresh} = useResource(
    () => api.listPartnerApplications({...filters, q: searchTerm || undefined, limit, offset}),
    `partners-${searchTerm}-${key}`
  );

  return (
    <PageSection
      title="Partner applications"
      description="People applying to list homes as brokers or to let their own homes as landlords."
    >
      <Card>
        <FilterBar>
          <Field label="Role" htmlFor="partner-role">
            <Select
              id="partner-role"
              placeholder="Brokers and landlords"
              options={[
                {value: 'broker', label: 'Broker'},
                {value: 'landlord', label: 'Landlord'},
              ]}
              value={filters.role}
              onChange={(event) => setFilter('role', event.target.value)}
            />
          </Field>
          <Field label="Status" htmlFor="partner-status">
            <Select
              id="partner-status"
              placeholder="Every status"
              options={QUEUE_STATUSES}
              value={filters.status}
              onChange={(event) => setFilter('status', event.target.value)}
            />
          </Field>
        </FilterBar>
      </Card>

      <Card>
        <DataTable<PartnerApplication & {id: string}>
          status={state.status}
          error={state.status === 'error' ? state.error : undefined}
          onRetry={refresh}
          rows={(state.data?.items ?? []).map((a) => ({...a, id: `${a.userId}-${a.role}`}))}
          emptyMessage="No applications match these filters."
          columns={[
            {key: 'person', header: 'Person', render: (a) => a.person.fullName ?? '—'},
            {key: 'phone', header: 'Phone', render: (a) => a.person.phoneNumber ?? '—'},
            {key: 'role', header: 'Role', render: (a) => ROLE_LABEL[a.role]},
            {
              key: 'submitted',
              header: 'Submitted',
              render: (a) => (a.application.submittedAt ? new Date(a.application.submittedAt).toLocaleDateString() : '—'),
            },
            {
              key: 'kyc',
              header: 'Identity',
              render: (a) => <StatusBadge status={a.person.kycStatus} label={KYC_STATUS_LABEL[a.person.kycStatus]} />,
            },
            {key: 'steps', header: 'Steps', render: (a) => stepsDone(a)},
            {
              key: 'status',
              header: 'Status',
              render: (a) => <StatusBadge status={a.status} label={ROLE_STATUS_LABEL[a.status]} />,
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (a) => (
                <RowActions>
                  <Button variant="ghost" size="small" onClick={() => setOpen(a)}>Review</Button>
                </RowActions>
              ),
            },
          ]}
        />
        {state.data && (
          <Pagination total={state.data.pagination.total} limit={limit} offset={offset} onChange={setOffset} />
        )}
      </Card>

      {open && (
        <ApplicationDrawer
          application={open}
          onClose={() => setOpen(null)}
          onDecided={(updated) => {
            setOpen(updated);
            refresh();
            // the sidebar badge and this queue move together
            attention.refresh();
          }}
        />
      )}
    </PageSection>
  );
}

function stepsDone(application: PartnerApplication) {
  const steps = application.application.steps;
  return `${steps.filter((s) => s.complete).length} of ${steps.length}`;
}

type Mode = 'idle' | 'approve' | 'reject' | 'action';

/** One application: the person, their evidence, and the decision panel. */
function ApplicationDrawer({
  application,
  onClose,
  onDecided,
}: {
  application: PartnerApplication;
  onClose: () => void;
  onDecided: (updated: PartnerApplication) => void;
}) {
  const api = useAdminApi();
  const [mode, setMode] = useState<Mode>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {person, application: state} = application;
  const decidable = application.status === 'pending_review';

  const identityDocuments = application.documents.filter((d) => !OWNERSHIP_DOCUMENTS.includes(d.document_type));
  const ownershipDocuments = application.documents.filter((d) => OWNERSHIP_DOCUMENTS.includes(d.document_type));

  async function decide(body: PartnerDecision) {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.decidePartnerApplication(application.userId, application.role, body);
      setMode('idle');
      onDecided(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record that decision');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`${person.fullName ?? 'Applicant'} · ${ROLE_LABEL[application.role]} application`}
      description={person.phoneNumber ?? undefined}
      onClose={onClose}
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      <DetailGrid
        items={[
          {label: 'Status', value: <StatusBadge status={application.status} label={ROLE_STATUS_LABEL[application.status]} />},
          {label: 'Identity', value: <StatusBadge status={person.kycStatus} label={KYC_STATUS_LABEL[person.kycStatus]} />},
          {label: 'Date of birth', value: person.dateOfBirth ?? '—'},
          {label: 'NIDA number', value: person.nationalIdNumber ?? '—'},
          {label: 'TIN', value: person.tinNumber ?? '—'},
          {label: 'Address', value: person.physicalAddress ?? '—'},
          {
            label: 'Getting paid',
            value: person.payoutMethod === 'bank' ? 'Bank account' : person.payoutMethod === 'mobile_money' ? 'Mobile money' : 'Not set',
          },
          {
            label: 'Agreement',
            value: state.agreementVersion
              ? `${state.agreementVersion}${state.agreementVersion !== state.currentAgreementVersion ? ` (current is ${state.currentAgreementVersion})` : ''}`
              : 'Not accepted',
          },
          {label: 'Applied', value: formatDate(state.appliedAt)},
          {label: 'Submitted', value: formatDate(state.submittedAt)},
          {label: 'Reviewed', value: formatDate(state.reviewedAt)},
          {label: 'Activated', value: formatDate(state.activatedAt)},
        ]}
      />

      <p className={fieldStyles.sectionTitle}>Steps</p>
      <ul className={fieldStyles.checklist}>
        {state.steps.map((step) => (
          <li key={step.step}>
            <StatusBadge status={step.complete ? 'verified' : 'pending'} label={step.complete ? 'Done' : 'Missing'} />{' '}
            {STEP_LABEL[step.step] ?? step.step}
          </li>
        ))}
      </ul>

      <p className={fieldStyles.sectionTitle}>Identity documents</p>
      <DocumentList documents={identityDocuments} />

      {application.role === 'landlord' && (
        <>
          <p className={fieldStyles.sectionTitle}>Ownership proof</p>
          <DocumentList documents={ownershipDocuments} />
        </>
      )}

      {application.remediations.length > 0 && (
        <>
          <p className={fieldStyles.sectionTitle}>Asked of them</p>
          {application.remediations.map((r) => (
            <div key={r.id} className={fieldStyles.listRow}>
              <span>{r.issue}</span>
              <span>{r.requested_action}</span>
            </div>
          ))}
        </>
      )}

      {state.rejectionReason && <p className={fieldStyles.hint}>Rejected because: {state.rejectionReason}</p>}

      <p className={fieldStyles.sectionTitle}>Decision</p>
      {error && mode !== 'approve' && mode !== 'reject' && (
        <div className={fieldStyles.errorBlock} role="alert">{error}</div>
      )}
      {!decidable ? (
        <p className={fieldStyles.hint}>
          This application is already decided ({ROLE_STATUS_LABEL[application.status]}). Documents are verified on the
          person&rsquo;s record under Users.
        </p>
      ) : mode === 'action' ? (
        <ActionNeededForm
          busy={busy}
          documents={application.documents}
          onCancel={() => setMode('idle')}
          onError={setError}
          onSubmit={(issue, requestedAction, documentId) =>
            decide({
              decision: 'action_needed',
              reason: issue,
              remediation: {issue, requestedAction, ...(documentId ? {documentId} : {})},
            })
          }
        />
      ) : (
        <div className={fieldStyles.modalFooter}>
          <Button variant="danger" onClick={() => setMode('reject')} disabled={busy}>Reject</Button>
          <Button variant="outline" onClick={() => setMode('action')} disabled={busy}>Ask for something</Button>
          <Button onClick={() => setMode('approve')} disabled={busy}>Approve</Button>
        </div>
      )}

      {mode === 'approve' && (
        <ConfirmDialog
          title={`Approve ${person.fullName ?? 'this applicant'} as a ${application.role}?`}
          description={`Their ${application.role} role becomes active, and they are told by SMS.`}
          confirmLabel="Approve"
          busy={busy}
          error={error}
          onConfirm={() => decide({decision: 'approve'})}
          onCancel={() => setMode('idle')}
        />
      )}
      {mode === 'reject' && (
        <ConfirmDialog
          title="Reject this application?"
          description="The applicant reads this reason in the app and by SMS."
          confirmLabel="Reject"
          destructive
          reasonLabel="Reason"
          reasonRequired
          busy={busy}
          error={error}
          onConfirm={(reason) => decide({decision: 'reject', reason})}
          onCancel={() => setMode('idle')}
        />
      )}
    </Modal>
  );
}

/** "Ask for something": what is wrong and what to do; becomes a KYC remediation. */
function ActionNeededForm({
  busy,
  documents,
  onCancel,
  onError,
  onSubmit,
}: {
  busy: boolean;
  documents: PartnerApplicationDocument[];
  onCancel: () => void;
  onError: (message: string | null) => void;
  onSubmit: (issue: string, requestedAction: string, documentId: string | null) => void;
}) {
  const [issue, setIssue] = useState('');
  const [requestedAction, setRequestedAction] = useState('');
  const [documentId, setDocumentId] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!issue.trim()) return onError('Say what the issue is');
    if (!requestedAction.trim()) return onError('Say what the applicant should do');
    onError(null);
    onSubmit(issue.trim(), requestedAction.trim(), documentId || null);
  }

  return (
    <form onSubmit={handleSubmit} className={fieldStyles.modalBody}>
      <Field label="What is wrong" htmlFor="action-issue">
        <TextArea id="action-issue" value={issue} onChange={(event) => setIssue(event.target.value)} />
      </Field>
      <Field label="What should they do" htmlFor="action-request">
        <TextArea id="action-request" value={requestedAction} onChange={(event) => setRequestedAction(event.target.value)} />
      </Field>
      <Field label="About which document (optional)" htmlFor="action-document">
        <Select
          id="action-document"
          placeholder="None in particular"
          options={documents.map((d) => ({value: d.id, label: DOCUMENT_LABEL[d.document_type] ?? d.document_type}))}
          value={documentId}
          onChange={(event) => setDocumentId(event.target.value)}
        />
      </Field>
      <div className={fieldStyles.modalFooter}>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</Button>
      </div>
    </form>
  );
}

/** The applicant's documents, read through the API like every KYC document. */
function DocumentList({documents}: {documents: PartnerApplicationDocument[]}) {
  if (documents.length === 0) return <p className={fieldStyles.hint}>Nothing uploaded yet.</p>;
  return (
    <ul className={fieldStyles.documentGrid}>
      {documents.map((document) => (
        <li key={document.id}>
          {document.has_thumbnail && (
            <AuthedImage
              source={{kind: 'kycDocument', id: document.id}}
              thumbnail
              alt={DOCUMENT_LABEL[document.document_type] ?? document.document_type}
              className={fieldStyles.documentThumb}
            />
          )}
          <span>{DOCUMENT_LABEL[document.document_type] ?? document.document_type}</span>{' '}
          <StatusBadge status={document.status} />
          {document.rejection_reason && <span className={fieldStyles.hint}> — {document.rejection_reason}</span>}
        </li>
      ))}
    </ul>
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : '—';
}
