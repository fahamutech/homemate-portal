import {useState} from 'react';
import type {FormEvent} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import type {DeclaredPayment, PaymentAwaitingInstructions} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {
  Button, Card, DataTable, DetailGrid, Field, Modal, RowActions,
  Select, TextArea, TextInput, fieldStyles,
} from '../../components/ui';
import {useAttention} from './attentionContext';
import {money} from './CollectionsTab';

/**
 * The two queues that stand between a customer and their booking.
 *
 * First: payments nobody has said where to pay, so the app shows "details are
 * being prepared" and the customer can do nothing. Second: payments a customer
 * says they have made, which a person must check against the account before
 * the money counts — that check is the whole of BR-005 in practice.
 */
export function PaymentQueueTab() {
  const api = useAdminApi();
  const attention = useAttention();
  const [instructingId, setInstructingId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<DeclaredPayment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const waiting = useResource(() => api.listPaymentsNeedingInstructions({limit: 50}), 'needs-instructions');
  const declared = useResource(() => api.listDeclaredPayments({limit: 50}), 'declared-payments');

  function reload() {
    waiting.refresh();
    declared.refresh();
    attention.refresh();
  }

  return (
    <>
      {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}

      <Card>
        <h3 className={fieldStyles.cardTitle}>Waiting for payment details</h3>
        <p className={fieldStyles.hint}>
          The customer cannot pay until somebody says where to send the money. Until then their app
          shows &ldquo;payment details are being prepared&rdquo;.
        </p>
        <DataTable<PaymentAwaitingInstructions>
          status={waiting.state.status}
          error={waiting.state.status === 'error' ? waiting.state.error : undefined}
          onRetry={waiting.refresh}
          rows={waiting.state.data?.items ?? []}
          emptyMessage="Every payment has details. Nothing is blocked."
          columns={[
            {key: 'reference', header: 'Payment', render: (p) => <code>{p.reference}</code>},
            {key: 'booking', header: 'Booking', render: (p) => p.booking_reference ?? '—'},
            {key: 'property', header: 'Property', render: (p) => p.property_title ?? '—'},
            {
              key: 'customer',
              header: 'Customer',
              render: (p) => (
                <span className={fieldStyles.inlineStack}>
                  <span>{p.payer_name ?? '—'}</span>
                  <span>{p.payer_phone ?? ''}</span>
                </span>
              ),
            },
            {key: 'amount', header: 'Amount', render: (p) => money(p.amount, p.currency)},
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (payment) => (
                <RowActions>
                  <Button size="small" onClick={() => setInstructingId(payment.id)}>
                    Publish details
                  </Button>
                </RowActions>
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <h3 className={fieldStyles.cardTitle}>Customers say they have paid</h3>
        <p className={fieldStyles.hint}>
          A claim settles nothing. Check it against the account, then verify — verifying is what
          releases the booking.
        </p>
        <DataTable<DeclaredPayment>
          status={declared.state.status}
          error={declared.state.status === 'error' ? declared.state.error : undefined}
          onRetry={declared.refresh}
          rows={declared.state.data?.items ?? []}
          emptyMessage="Nothing is waiting to be checked."
          columns={[
            {key: 'reference', header: 'Payment', render: (p) => <code>{p.reference}</code>},
            {
              key: 'customer',
              header: 'Customer',
              render: (p) => (
                <span className={fieldStyles.inlineStack}>
                  <span>{p.payer_name ?? '—'}</span>
                  <span>{p.payer_phone ?? ''}</span>
                </span>
              ),
            },
            {key: 'amount', header: 'Amount', render: (p) => money(p.amount, p.currency)},
            {
              key: 'claim',
              header: 'They quoted',
              render: (p) => (
                <span className={fieldStyles.inlineStack}>
                  <code>{p.customer_declared_reference ?? 'no code given'}</code>
                  <span>{new Date(p.customer_declared_paid_at).toLocaleString()}</span>
                </span>
              ),
            },
            {
              key: 'expected',
              header: 'Should have paid',
              render: (p) => (
                <span className={fieldStyles.inlineStack}>
                  <span>{p.account_number ?? '—'}</span>
                  <span>ref {p.payment_reference ?? '—'}</span>
                </span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (payment) => (
                <RowActions>
                  <Button size="small" onClick={() => setVerifying(payment)}>Verify</Button>
                </RowActions>
              ),
            },
          ]}
        />
      </Card>

      {instructingId && (
        <InstructionsModal
          paymentId={instructingId}
          onClose={() => setInstructingId(null)}
          onSaved={() => {
            setInstructingId(null);
            reload();
          }}
        />
      )}

      {verifying && (
        <VerifyModal
          payment={verifying}
          onClose={() => setVerifying(null)}
          onVerified={() => {
            setVerifying(null);
            reload();
          }}
          onError={setError}
        />
      )}
    </>
  );
}

/**
 * Where the customer should send the money. The app shows these words exactly
 * as typed, so this is the one place they are authored — and getting the
 * number wrong here sends somebody's deposit to a stranger.
 */
function InstructionsModal({
  paymentId,
  onClose,
  onSaved,
}: {
  paymentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useAdminApi();
  const methods = useResource(() => api.listPaymentMethods({activeOnly: true}), 'instruction-methods');
  const existing = useResource(() => api.getPaymentInstructions(paymentId), `instructions-${paymentId}`);

  const [form, setForm] = useState({
    displayName: 'HomeMate Africa Ltd',
    accountName: '',
    accountNumber: '',
    paymentReference: '',
    instructions: '',
    paymentMethodId: '',
  });
  const [seeded, setSeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing an existing set starts from what is already published.
  const current = existing.state.data?.instructions;
  if (current && !seeded) {
    setSeeded(true);
    setForm({
      displayName: current.display_name,
      accountName: current.account_name ?? '',
      accountNumber: current.account_number,
      paymentReference: current.payment_reference,
      instructions: current.instructions ?? '',
      paymentMethodId: '',
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.setPaymentInstructions(paymentId, form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish those details');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Where should the customer pay?"
      description="Shown in the app exactly as you type it."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className={fieldStyles.modalBody}>
        {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}

        <Field label="Payment method" htmlFor="pi-method">
          <Select
            id="pi-method"
            placeholder="Not specified"
            options={(methods.state.data?.items ?? []).map((m) => ({value: m.id, label: m.name}))}
            value={form.paymentMethodId}
            onChange={(event) => setForm({...form, paymentMethodId: event.target.value})}
          />
        </Field>
        <Field label="Payee name the customer will see" htmlFor="pi-display">
          <TextInput
            id="pi-display"
            value={form.displayName}
            onChange={(event) => setForm({...form, displayName: event.target.value})}
            required
          />
        </Field>
        <Field label="Account name" htmlFor="pi-account-name">
          <TextInput
            id="pi-account-name"
            value={form.accountName}
            onChange={(event) => setForm({...form, accountName: event.target.value})}
          />
        </Field>
        <Field label="Lipa Namba or account number" htmlFor="pi-account">
          <TextInput
            id="pi-account"
            value={form.accountNumber}
            onChange={(event) => setForm({...form, accountNumber: event.target.value})}
            required
          />
        </Field>
        <Field label="Reference the customer must quote" htmlFor="pi-reference">
          <TextInput
            id="pi-reference"
            value={form.paymentReference}
            onChange={(event) => setForm({...form, paymentReference: event.target.value})}
            required
          />
        </Field>
        <Field label="Instructions" htmlFor="pi-instructions">
          <TextArea
            id="pi-instructions"
            rows={3}
            value={form.instructions}
            onChange={(event) => setForm({...form, instructions: event.target.value})}
            placeholder="Send to Lipa Namba 5566778 and quote the reference."
          />
        </Field>

        <div className={fieldStyles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish to the app'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Confirming that money actually arrived. This is the authorised
 * reconciliation BR-005 requires — the customer's word got it onto this
 * screen, and a person's decision is what settles it.
 */
function VerifyModal({
  payment,
  onClose,
  onVerified,
  onError,
}: {
  payment: DeclaredPayment;
  onClose: () => void;
  onVerified: () => void;
  onError: (message: string) => void;
}) {
  const api = useAdminApi();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true);
    try {
      await api.reconcilePayment(payment.id, {note: note || undefined});
      onVerified();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'That payment could not be verified');
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await api.failPayment(payment.id, {reason: note || 'No matching payment found on the account'});
      onVerified();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'That payment could not be marked failed');
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Verify ${payment.reference}`}
      description="Check the account before confirming. Confirming releases the booking."
      onClose={onClose}
    >
      <DetailGrid
        items={[
          {label: 'Customer', value: `${payment.payer_name ?? '—'} · ${payment.payer_phone ?? ''}`},
          {label: 'Amount', value: money(payment.amount, payment.currency)},
          {label: 'Property', value: payment.property_title ?? '—'},
          {label: 'Booking', value: payment.booking_reference ?? '—'},
          {label: 'They said they paid', value: new Date(payment.customer_declared_paid_at).toLocaleString()},
          {label: 'Code they quoted', value: payment.customer_declared_reference ?? 'none given'},
          {label: 'Their note', value: payment.customer_declared_note ?? '—'},
          {label: 'Should have paid to', value: payment.account_number ?? '—'},
          {label: 'Quoting reference', value: payment.payment_reference ?? '—'},
        ]}
      />

      <div className={fieldStyles.modalBody}>
        <Field label="Note for the record" htmlFor="verify-note">
          <TextArea
            id="verify-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Matched on the M-Pesa statement at 10:04"
          />
        </Field>

        <div className={fieldStyles.modalFooter}>
          <Button variant="outline" onClick={onClose} disabled={busy}>Close</Button>
          <Button variant="danger" onClick={reject} disabled={busy}>
            No payment found
          </Button>
          <Button onClick={verify} disabled={busy}>
            {busy ? 'Confirming…' : 'Confirm received'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
