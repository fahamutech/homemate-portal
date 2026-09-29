import {useState} from 'react';
import type {FormEvent} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import type {KycDocument, KycProfile, PartnerRole, UserRole} from '../../api/adminApi';
import {ROLE_LABEL, ROLE_STATUS_LABEL} from './partners/labels';
import {useResource} from '../../hooks/useResource';
import {prepareImages} from './imagePipeline';
import {AuthedImage} from './AuthedImage';
import {
  Button, ConfirmDialog, DetailGrid, Field, Modal, Select, StatusBadge, TextArea, TextInput, humanise, fieldStyles,
} from '../../components/ui';
import styles from './UserDetailModal.module.css';

const TABS = ['Account', 'Roles', 'Identity', 'Documents', 'Remediation'] as const;
type Tab = (typeof TABS)[number];

const DOCUMENT_TYPES = [
  {value: 'national_id', label: 'National ID (NIDA)'},
  {value: 'passport', label: 'Passport'},
  {value: 'drivers_licence', label: "Driver's licence"},
  {value: 'voters_id', label: "Voter's ID"},
  {value: 'tin_certificate', label: 'TIN certificate'},
  {value: 'business_licence', label: 'Business licence (BRELA)'},
  {value: 'title_deed', label: 'Title deed'},
  {value: 'utility_bill', label: 'Utility bill'},
  {value: 'bank_statement', label: 'Bank statement'},
  {value: 'selfie', label: 'Selfie'},
  {value: 'other', label: 'Other'},
];

const GENDERS = [
  {value: 'female', label: 'Female'},
  {value: 'male', label: 'Male'},
  {value: 'other', label: 'Other'},
  {value: 'undisclosed', label: 'Prefer not to say'},
];

/** Which identity fields a profile must carry before it is worth reviewing. */
const REQUIRED_FOR_REVIEW: {key: keyof KycProfile; label: string}[] = [
  {key: 'full_name', label: 'Full name'},
  {key: 'date_of_birth', label: 'Date of birth'},
  {key: 'national_id_number', label: 'National ID number'},
  {key: 'physical_address', label: 'Physical address'},
];

/**
 * Everything HomeMate holds on one person, in the order an operator works
 * through it: who the account is, what identity they claim, what evidence
 * backs it, and what they have been asked to put right.
 *
 * Money moves to these people, so this is where a payout being held gets
 * resolved — which is why the banking details sit beside the identity rather
 * than in a separate screen.
 */
export function UserDetailModal({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const api = useAdminApi();
  const [tab, setTab] = useState<Tab>('Account');
  const {state, refresh} = useResource(() => api.getKycProfile(userId), `kyc-${userId}`);
  const profile = state.data;

  function reload() {
    refresh();
    onChanged();
  }

  return (
    <Modal
      title={profile?.full_name ?? 'User'}
      description={profile ? `${humanise(profile.role)} · ${profile.phone_number ?? profile.email ?? ''}` : undefined}
      onClose={onClose}
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      {state.status === 'error' && (
        <div className={fieldStyles.errorBlock} role="alert">{state.error}</div>
      )}
      {!profile && state.status === 'loading' && <p className={styles.muted}>Loading…</p>}

      {profile && (
        <>
          <div className={styles.summary}>
            {profile.profile_photo_url ? (
              <AuthedImage
                source={{kind: 'profilePhoto', userId: profile.id}}
                thumbnail
                alt={`${profile.full_name ?? 'User'} profile photo`}
                className={styles.avatar}
              />
            ) : (
              <span className={styles.avatarEmpty} aria-hidden="true" />
            )}
            <div>
              <p className={styles.summaryLine}>
                Account <StatusBadge status={profile.status} /> · Identity{' '}
                <StatusBadge status={profile.kyc_status ?? 'not_started'} />
              </p>
              <p className={styles.muted}>
                {profile.documents.length} document{profile.documents.length === 1 ? '' : 's'} ·{' '}
                {profile.remediations.filter((r) => !r.resolved).length} open remediation
                {profile.remediations.filter((r) => !r.resolved).length === 1 ? '' : 's'}
                {Number(profile.unpaid_balance ?? 0) > 0 && (
                  <> · {Number(profile.unpaid_balance).toLocaleString()} TZS awaiting payout</>
                )}
              </p>
            </div>
          </div>

          <nav className={styles.tabs} aria-label="User details">
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                className={`${styles.tab} ${tab === name ? styles.tabActive : ''}`}
                onClick={() => setTab(name)}
              >
                {name}
                {name === 'Documents' && Number(profile.documents_pending ?? 0) > 0 && (
                  <span className={styles.tabBadge}>{profile.documents_pending}</span>
                )}
                {name === 'Remediation' && Number(profile.open_remediations ?? 0) > 0 && (
                  <span className={styles.tabBadge}>{profile.open_remediations}</span>
                )}
              </button>
            ))}
          </nav>

          {tab === 'Account' && <AccountTab profile={profile} />}
          {tab === 'Roles' && <RolesTab profile={profile} onChanged={reload} />}
          {tab === 'Identity' && <IdentityTab profile={profile} onSaved={reload} />}
          {tab === 'Documents' && <DocumentsTab profile={profile} onChanged={reload} />}
          {tab === 'Remediation' && <RemediationTab profile={profile} onChanged={reload} />}
        </>
      )}
    </Modal>
  );
}

function AccountTab({profile}: {profile: KycProfile}) {
  return (
    <DetailGrid
      items={[
        {label: 'Status', value: <StatusBadge status={profile.status} />},
        {label: 'Role', value: humanise(profile.role)},
        {label: 'Phone', value: profile.phone_number ?? '—'},
        {label: 'Email', value: profile.email ?? '—'},
        {label: 'Organization', value: profile.organization_name ?? '—'},
        {label: 'Job title', value: profile.job_title ?? '—'},
        {label: 'Suspension reason', value: profile.suspension_reason ?? '—'},
        {label: 'Properties', value: profile.property_count ?? '0'},
        {label: 'Registered', value: new Date(profile.created_at).toLocaleDateString()},
        {
          label: 'Last login',
          value: profile.last_login_at ? new Date(profile.last_login_at).toLocaleString() : 'Never',
        },
      ]}
    />
  );
}

/**
 * A person's roles (T01): customer, broker, landlord, each with its own
 * status. Staff can pause a partner role (with a reason the person is shown)
 * and restore it; applying and approving happen in the Partners queue.
 */
function RolesTab({profile, onChanged}: {profile: KycProfile; onChanged: () => void}) {
  const api = useAdminApi();
  const [changing, setChanging] = useState<{role: PartnerRole; to: 'active' | 'suspended'} | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roles: UserRole[] = profile.roles ?? [];

  async function confirm(reason: string) {
    if (!changing) return;
    setBusy(true);
    setError(null);
    try {
      await api.changeUserRoleStatus(
        profile.id,
        changing.role,
        changing.to === 'suspended' ? {status: 'suspended', reason} : {status: 'active'}
      );
      setChanging(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change that role');
    } finally {
      setBusy(false);
    }
  }

  if (roles.length === 0) return <p className={styles.muted}>Staff accounts hold no customer or partner roles.</p>;

  return (
    <div className={fieldStyles.modalBody}>
      {roles.map((r) => (
        <div key={r.role} className={fieldStyles.listRow} data-testid={`role-${r.role}`}>
          <span className={fieldStyles.inlineStack}>
            <strong>{ROLE_LABEL[r.role]}</strong>
            <StatusBadge status={r.status} label={ROLE_STATUS_LABEL[r.status]} />
            <span className={styles.muted}>
              {r.activatedAt ? `active since ${new Date(r.activatedAt).toLocaleDateString()}` : ''}
              {r.rejectionReason ? ` · rejected: ${r.rejectionReason}` : ''}
            </span>
          </span>
          {r.role !== 'customer' && r.status === 'active' && (
            <Button size="small" variant="outline" onClick={() => setChanging({role: r.role as PartnerRole, to: 'suspended'})}>
              Suspend
            </Button>
          )}
          {r.role !== 'customer' && r.status === 'suspended' && (
            <Button size="small" onClick={() => setChanging({role: r.role as PartnerRole, to: 'active'})}>
              Reactivate
            </Button>
          )}
        </div>
      ))}

      {changing && (
        <ConfirmDialog
          title={`${changing.to === 'suspended' ? 'Suspend' : 'Reactivate'} ${ROLE_LABEL[changing.role].toLowerCase()} role?`}
          description={
            changing.to === 'suspended'
              ? 'Their workspace stops working at once. They are told why.'
              : 'Their workspace works again straight away.'
          }
          confirmLabel={changing.to === 'suspended' ? 'Suspend' : 'Reactivate'}
          destructive={changing.to === 'suspended'}
          reasonLabel={changing.to === 'suspended' ? 'Reason' : undefined}
          reasonRequired={changing.to === 'suspended'}
          busy={busy}
          error={error}
          onConfirm={confirm}
          onCancel={() => setChanging(null)}
        />
      )}
    </div>
  );
}

/** Identity details and the account-level decision that rests on them. */
function IdentityTab({profile, onSaved}: {profile: KycProfile; onSaved: () => void}) {
  const api = useAdminApi();
  const [form, setForm] = useState({
    dateOfBirth: profile.date_of_birth ?? '',
    gender: profile.gender ?? '',
    nationality: profile.nationality ?? '',
    nationalIdNumber: profile.national_id_number ?? '',
    tinNumber: profile.tin_number ?? '',
    physicalAddress: profile.physical_address ?? '',
    postalAddress: profile.postal_address ?? '',
    emergencyContactName: profile.emergency_contact_name ?? '',
    emergencyContactPhone: profile.emergency_contact_phone ?? '',
    nextOfKinName: profile.next_of_kin_name ?? '',
    nextOfKinPhone: profile.next_of_kin_phone ?? '',
    bankName: profile.bank_name ?? '',
    bankAccountName: profile.bank_account_name ?? '',
    bankAccountNumber: profile.bank_account_number ?? '',
    mobileMoneyProvider: profile.mobile_money_provider ?? '',
    mobileMoneyNumber: profile.mobile_money_number ?? '',
    notes: profile.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const missing = REQUIRED_FOR_REVIEW.filter(({key}) => !profile[key]);

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({...current, [key]: value}));
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.updateKycProfile(profile.id, form);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save these details');
    } finally {
      setBusy(false);
    }
  }

  async function decide(status: string) {
    setBusy(true);
    setError(null);
    try {
      await api.reviewKyc(profile.id, {
        status,
        rejectionReason: status === 'rejected' ? rejectionReason : undefined,
      });
      setRejecting(false);
      setRejectionReason('');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record that decision');
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoto(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const {prepared, errors} = await prepareImages([files[0]]);
      if (!prepared.length) throw new Error(errors.join(' ') || 'That file could not be converted');
      await api.setProfilePhoto(profile.id, {
        image: prepared[0].image,
        thumbnail: prepared[0].thumbnail,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that photo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={fieldStyles.modalBody}>
      {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}

      <div className={styles.decision}>
        <div>
          <p className={styles.decisionTitle}>
            Identity verification <StatusBadge status={profile.kyc_status ?? 'not_started'} />
          </p>
          {profile.kyc_reviewed_by && (
            <p className={styles.muted}>
              Decided by {profile.kyc_reviewed_by}
              {profile.kyc_reviewed_at && ` on ${new Date(profile.kyc_reviewed_at).toLocaleDateString()}`}
            </p>
          )}
          {profile.kyc_rejection_reason && (
            <p className={styles.muted}>Reason: {profile.kyc_rejection_reason}</p>
          )}
          {missing.length > 0 && (
            <p className={styles.warning}>
              Still missing: {missing.map((field) => field.label).join(', ')}
            </p>
          )}
        </div>
        <div className={styles.decisionActions}>
          <Button size="small" onClick={() => decide('verified')} disabled={busy}>Verify</Button>
          <Button size="small" variant="outline" onClick={() => setRejecting(true)} disabled={busy}>
            Reject
          </Button>
        </div>
      </div>

      {rejecting && (
        <div className={styles.rejectBox}>
          <Field label="Why is this identity rejected?" htmlFor="kyc-reject-reason">
            <TextArea
              id="kyc-reject-reason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
            />
          </Field>
          <div className={styles.decisionActions}>
            <Button size="small" variant="outline" onClick={() => setRejecting(false)}>Cancel</Button>
            <Button size="small" variant="danger" onClick={() => decide('rejected')} disabled={busy}>
              Confirm rejection
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <p className={styles.sectionTitle}>Identity</p>
        <div className={styles.grid}>
          <Field label="Date of birth" htmlFor="kyc-dob">
            <TextInput id="kyc-dob" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
          </Field>
          <Field label="Gender" htmlFor="kyc-gender">
            <Select id="kyc-gender" placeholder="Not recorded" options={GENDERS} value={form.gender} onChange={(e) => set('gender', e.target.value)} />
          </Field>
          <Field label="Nationality" htmlFor="kyc-nationality">
            <TextInput id="kyc-nationality" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
          </Field>
          <Field label="National ID (NIDA)" htmlFor="kyc-nida">
            <TextInput id="kyc-nida" value={form.nationalIdNumber} onChange={(e) => set('nationalIdNumber', e.target.value)} />
          </Field>
          <Field label="TIN" htmlFor="kyc-tin">
            <TextInput id="kyc-tin" value={form.tinNumber} onChange={(e) => set('tinNumber', e.target.value)} />
          </Field>
          <Field label="Physical address" htmlFor="kyc-address" className={styles.fullWidth}>
            <TextInput id="kyc-address" value={form.physicalAddress} onChange={(e) => set('physicalAddress', e.target.value)} />
          </Field>
          <Field label="Postal address" htmlFor="kyc-postal">
            <TextInput id="kyc-postal" value={form.postalAddress} onChange={(e) => set('postalAddress', e.target.value)} />
          </Field>
        </div>

        <p className={styles.sectionTitle}>Contacts</p>
        <div className={styles.grid}>
          <Field label="Emergency contact" htmlFor="kyc-emergency-name">
            <TextInput id="kyc-emergency-name" value={form.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} />
          </Field>
          <Field label="Emergency phone" htmlFor="kyc-emergency-phone">
            <TextInput id="kyc-emergency-phone" value={form.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} />
          </Field>
          <Field label="Next of kin" htmlFor="kyc-kin-name">
            <TextInput id="kyc-kin-name" value={form.nextOfKinName} onChange={(e) => set('nextOfKinName', e.target.value)} />
          </Field>
          <Field label="Next of kin phone" htmlFor="kyc-kin-phone">
            <TextInput id="kyc-kin-phone" value={form.nextOfKinPhone} onChange={(e) => set('nextOfKinPhone', e.target.value)} />
          </Field>
        </div>

        <p className={styles.sectionTitle}>Where money is sent</p>
        <div className={styles.grid}>
          <Field label="Bank" htmlFor="kyc-bank">
            <TextInput id="kyc-bank" value={form.bankName} onChange={(e) => set('bankName', e.target.value)} />
          </Field>
          <Field label="Account name" htmlFor="kyc-bank-name">
            <TextInput id="kyc-bank-name" value={form.bankAccountName} onChange={(e) => set('bankAccountName', e.target.value)} />
          </Field>
          <Field label="Account number" htmlFor="kyc-bank-number">
            <TextInput id="kyc-bank-number" value={form.bankAccountNumber} onChange={(e) => set('bankAccountNumber', e.target.value)} />
          </Field>
          <Field label="Mobile money provider" htmlFor="kyc-momo-provider">
            <TextInput id="kyc-momo-provider" placeholder="M-Pesa" value={form.mobileMoneyProvider} onChange={(e) => set('mobileMoneyProvider', e.target.value)} />
          </Field>
          <Field label="Mobile money number" htmlFor="kyc-momo-number">
            <TextInput id="kyc-momo-number" value={form.mobileMoneyNumber} onChange={(e) => set('mobileMoneyNumber', e.target.value)} />
          </Field>
        </div>

        <Field label="Operator notes" htmlFor="kyc-notes">
          <TextArea id="kyc-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        <Field label="Profile photo" htmlFor="kyc-photo">
          <input id="kyc-photo" type="file" accept="image/*" onChange={(event) => handlePhoto(event.target.files)} />
        </Field>
        <p className={styles.muted}>
          Converted to WebP in your browser before upload, and only ever served through an authenticated request.
        </p>

        <div className={fieldStyles.modalFooter}>
          {saved && <span className={styles.saved} role="status">Saved</span>}
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save identity details'}</Button>
        </div>
      </form>
    </div>
  );
}

function DocumentsTab({profile, onChanged}: {profile: KycProfile; onChanged: () => void}) {
  const api = useAdminApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<KycDocument | null>(null);
  const [reason, setReason] = useState('');
  const [upload, setUpload] = useState({documentType: 'national_id', documentNumber: '', issuedOn: '', expiresOn: ''});
  const [file, setFile] = useState<File | null>(null);

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Choose a file to upload');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const {prepared, errors} = await prepareImages([file]);
      if (!prepared.length) throw new Error(errors.join(' ') || 'That file could not be converted');
      await api.addKycDocument(profile.id, {
        ...upload,
        documentNumber: upload.documentNumber || undefined,
        issuedOn: upload.issuedOn || undefined,
        expiresOn: upload.expiresOn || undefined,
        file: prepared[0].image,
        thumbnail: prepared[0].thumbnail,
      });
      setFile(null);
      setUpload({documentType: 'national_id', documentNumber: '', issuedOn: '', expiresOn: ''});
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that document');
    } finally {
      setBusy(false);
    }
  }

  async function review(document: KycDocument, status: string) {
    setBusy(true);
    setError(null);
    try {
      await api.reviewKycDocument(document.id, {
        status,
        rejectionReason: status === 'rejected' ? reason : undefined,
      });
      setRejecting(null);
      setReason('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record that decision');
    } finally {
      setBusy(false);
    }
  }

  async function remove(document: KycDocument) {
    setBusy(true);
    setError(null);
    try {
      await api.deleteKycDocument(document.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that document');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={fieldStyles.modalBody}>
      {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}

      {profile.documents.length === 0 ? (
        <p className={styles.muted}>No identity documents have been collected yet.</p>
      ) : (
        <ul className={styles.documentList}>
          {profile.documents.map((document) => (
            <li key={document.id} className={styles.document} data-testid={`document-${document.id}`}>
              <AuthedImage
                source={{kind: 'kycDocument', id: document.id}}
                thumbnail
                alt={humanise(document.document_type)}
                className={styles.documentThumb}
              />
              <div className={styles.documentBody}>
                <p className={styles.documentTitle}>
                  {humanise(document.document_type)} <StatusBadge status={document.status} />
                  {document.expired && <span className={styles.warning}> Expired</span>}
                </p>
                <p className={styles.muted}>
                  {document.document_number ?? 'No number recorded'}
                  {document.expires_on && ` · expires ${document.expires_on}`}
                  {document.reviewed_by && ` · reviewed by ${document.reviewed_by}`}
                </p>
                {document.rejection_reason && (
                  <p className={styles.muted}>Reason: {document.rejection_reason}</p>
                )}
              </div>
              <div className={styles.documentActions}>
                {document.status !== 'verified' && (
                  <Button size="small" onClick={() => review(document, 'verified')} disabled={busy}>
                    Verify
                  </Button>
                )}
                {document.status !== 'rejected' && (
                  <Button size="small" variant="outline" onClick={() => setRejecting(document)} disabled={busy}>
                    Reject
                  </Button>
                )}
                <Button size="small" variant="ghost" onClick={() => remove(document)} disabled={busy}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rejecting && (
        <div className={styles.rejectBox}>
          <Field label={`Why is the ${humanise(rejecting.document_type)} rejected?`} htmlFor="doc-reject-reason">
            <TextArea id="doc-reject-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <div className={styles.decisionActions}>
            <Button size="small" variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button size="small" variant="danger" onClick={() => review(rejecting, 'rejected')} disabled={busy}>
              Confirm rejection
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleUpload}>
        <p className={styles.sectionTitle}>Add a document</p>
        <div className={styles.grid}>
          <Field label="Document type" htmlFor="doc-type">
            <Select
              id="doc-type"
              options={DOCUMENT_TYPES}
              value={upload.documentType}
              onChange={(event) => setUpload({...upload, documentType: event.target.value})}
            />
          </Field>
          <Field label="Document number" htmlFor="doc-number">
            <TextInput
              id="doc-number"
              value={upload.documentNumber}
              onChange={(event) => setUpload({...upload, documentNumber: event.target.value})}
            />
          </Field>
          <Field label="Issued on" htmlFor="doc-issued">
            <TextInput
              id="doc-issued"
              type="date"
              value={upload.issuedOn}
              onChange={(event) => setUpload({...upload, issuedOn: event.target.value})}
            />
          </Field>
          <Field label="Expires on" htmlFor="doc-expires">
            <TextInput
              id="doc-expires"
              type="date"
              value={upload.expiresOn}
              onChange={(event) => setUpload({...upload, expiresOn: event.target.value})}
            />
          </Field>
          <Field label="File" htmlFor="doc-file" className={styles.fullWidth}>
            <input
              id="doc-file"
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
        </div>
        <div className={fieldStyles.modalFooter}>
          <Button type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload document'}</Button>
        </div>
      </form>
    </div>
  );
}

/** What the user has been asked to put right, and whether they did. */
function RemediationTab({profile, onChanged}: {profile: KycProfile; onChanged: () => void}) {
  const api = useAdminApi();
  const [form, setForm] = useState({issue: '', requestedAction: ''});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.openRemediation(profile.id, form);
      setForm({issue: '', requestedAction: ''});
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not raise that remediation');
    } finally {
      setBusy(false);
    }
  }

  async function resolve(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.resolveRemediation(id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close that remediation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={fieldStyles.modalBody}>
      {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}

      {profile.remediations.length === 0 ? (
        <p className={styles.muted}>Nothing has been raised against this account.</p>
      ) : (
        <ul className={styles.remediationList}>
          {profile.remediations.map((remediation) => (
            <li key={remediation.id} className={styles.remediation}>
              <div>
                <p className={styles.documentTitle}>
                  {remediation.issue}{' '}
                  <StatusBadge status={remediation.resolved ? 'resolved' : 'open'} />
                </p>
                <p className={styles.muted}>Asked for: {remediation.requested_action}</p>
                <p className={styles.muted}>
                  Raised by {remediation.raised_by ?? 'unknown'} on{' '}
                  {new Date(remediation.created_at).toLocaleDateString()}
                  {remediation.resolved_by && ` · closed by ${remediation.resolved_by}`}
                </p>
              </div>
              {!remediation.resolved && (
                <Button size="small" variant="outline" onClick={() => resolve(remediation.id)} disabled={busy}>
                  Mark resolved
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={open}>
        <p className={styles.sectionTitle}>Ask for a correction</p>
        <Field label="What is wrong?" htmlFor="rem-issue">
          <TextInput
            id="rem-issue"
            value={form.issue}
            onChange={(event) => setForm({...form, issue: event.target.value})}
            required
          />
        </Field>
        <Field label="What should they do?" htmlFor="rem-action">
          <TextArea
            id="rem-action"
            value={form.requestedAction}
            onChange={(event) => setForm({...form, requestedAction: event.target.value})}
            required
          />
        </Field>
        <div className={fieldStyles.modalFooter}>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Raise remediation'}</Button>
        </div>
      </form>
    </div>
  );
}
