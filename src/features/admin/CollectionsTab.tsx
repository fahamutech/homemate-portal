import {useState} from 'react';
import type {FormEvent} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import type {Payment, PaymentDetail} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {useListFilters} from '../../hooks/useListFilters';
import {
  Button, Card, DataTable, DetailGrid, Field, FilterBar, Modal, Pagination,
  RowActions, Select, StatusBadge, TextArea, TextInput, humanise, fieldStyles,
} from '../../components/ui';
import styles from './MoneyTabs.module.css';

const STATUSES = [
  {value: 'pending', label: 'Pending'},
  {value: 'successful', label: 'Successful'},
  {value: 'failed', label: 'Failed'},
  {value: 'reversed', label: 'Reversed'},
  {value: 'refunded', label: 'Refunded'},
];

const PURPOSES = [
  {value: 'rent', label: 'Rent'},
  {value: 'deposit', label: 'Deposit'},
  {value: 'advance_rent', label: 'Advance rent'},
  {value: 'service_charge', label: 'Service charge'},
  {value: 'other', label: 'Other'},
];

export function money(amount: string | number | null | undefined, currency = 'TZS') {
  const value = Number(amount ?? 0);
  return `${currency} ${value.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
}

/**
 * Money coming in. A collection is recorded as pending and split the moment it
 * exists; it becomes `successful` only when a provider confirms it or a
 * finance officer reconciles it by hand — there is deliberately no button
 * that simply declares a payment received.
 */
export function CollectionsTab({searchTerm, onChanged}: {searchTerm: string; onChanged: () => void}) {
  const api = useAdminApi();
  const {filters, setFilter, offset, setOffset, key, limit} = useListFilters({
    status: '', purpose: '', from: '', to: '',
  });
  const [recording, setRecording] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const {state, refresh} = useResource(
    () => api.listPayments({...filters, query: searchTerm || undefined, limit, offset}),
    `payments-${searchTerm}-${key}`
  );

  function reload() {
    refresh();
    onChanged();
  }

  return (
    <>
      <div className={fieldStyles.tabActions}>
        <Button onClick={() => setRecording(true)}>Record a collection</Button>
      </div>

      <Card>
        <FilterBar>
          <Field label="Status" htmlFor="pay-status">
            <Select
              id="pay-status"
              placeholder="All statuses"
              options={STATUSES}
              value={filters.status}
              onChange={(event) => setFilter('status', event.target.value)}
            />
          </Field>
          <Field label="Purpose" htmlFor="pay-purpose">
            <Select
              id="pay-purpose"
              placeholder="Any purpose"
              options={PURPOSES}
              value={filters.purpose}
              onChange={(event) => setFilter('purpose', event.target.value)}
            />
          </Field>
          <Field label="From" htmlFor="pay-from">
            <TextInput
              id="pay-from"
              type="date"
              value={filters.from}
              onChange={(event) => setFilter('from', event.target.value)}
            />
          </Field>
          <Field label="To" htmlFor="pay-to">
            <TextInput
              id="pay-to"
              type="date"
              value={filters.to}
              onChange={(event) => setFilter('to', event.target.value)}
            />
          </Field>
        </FilterBar>
      </Card>

      <Card>
        <DataTable<Payment>
          status={state.status}
          error={state.status === 'error' ? state.error : undefined}
          onRetry={refresh}
          rows={state.data?.items ?? []}
          emptyMessage="No collections match these filters."
          columns={[
            {key: 'reference', header: 'Reference', render: (p) => <code>{p.reference}</code>},
            {
              key: 'property',
              header: 'Property',
              render: (p) => p.property_title ?? p.property_reference ?? '—',
            },
            {key: 'payer', header: 'Paid by', render: (p) => p.payer_name ?? '—'},
            {key: 'purpose', header: 'Purpose', render: (p) => humanise(p.purpose)},
            {key: 'amount', header: 'Amount', render: (p) => money(p.amount, p.currency)},
            {
              key: 'status',
              header: 'Status',
              render: (p) => (
                <span className={fieldStyles.inlineStack}>
                  <StatusBadge status={p.status} />
                  {p.status === 'failed' && p.failure_reason && <span>{p.failure_reason}</span>}
                </span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (payment) => (
                <RowActions>
                  <Button variant="ghost" size="small" onClick={() => setDetailId(payment.id)}>
                    View
                  </Button>
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

      {recording && (
        <RecordPaymentModal
          onClose={() => setRecording(false)}
          onSaved={() => {
            setRecording(false);
            reload();
          }}
        />
      )}

      {detailId && (
        <PaymentDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={reload} />
      )}
    </>
  );
}

function RecordPaymentModal({onClose, onSaved}: {onClose: () => void; onSaved: () => void}) {
  const api = useAdminApi();
  const [form, setForm] = useState({
    propertyId: '',
    payerUserId: '',
    amount: '',
    purpose: 'rent',
    paymentMethodId: '',
    periodStart: '',
    periodEnd: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const properties = useResource(() => api.listProperties({limit: 100}), 'payment-properties');
  const customers = useResource(() => api.listUsers({role: 'customer', limit: 100}), 'payment-customers');
  const methods = useResource(() => api.listPaymentMethods({activeOnly: true}), 'payment-active-methods');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.recordPayment({
        ...form,
        payerUserId: form.payerUserId || undefined,
        paymentMethodId: form.paymentMethodId || undefined,
        periodStart: form.periodStart || undefined,
        periodEnd: form.periodEnd || undefined,
        notes: form.notes || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record this collection');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Record a collection"
      description="It opens as pending, and is split between the landlord, any broker or agency, and HomeMate straight away."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className={fieldStyles.modalBody}>
        {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}
        <Field label="Property" htmlFor="rec-property">
          <Select
            id="rec-property"
            placeholder="Select a property"
            options={(properties.state.data?.items ?? []).map((p) => ({
              value: p.id,
              label: `${p.reference_code} · ${p.title}`,
            }))}
            value={form.propertyId}
            onChange={(event) => setForm({...form, propertyId: event.target.value})}
            required
          />
        </Field>
        <Field label="Paid by" htmlFor="rec-payer">
          <Select
            id="rec-payer"
            placeholder="Select the tenant"
            options={(customers.state.data?.items ?? []).map((u) => ({
              value: u.id,
              label: `${u.full_name ?? 'Unnamed'} · ${u.phone_number ?? ''}`,
            }))}
            value={form.payerUserId}
            onChange={(event) => setForm({...form, payerUserId: event.target.value})}
          />
        </Field>
        <Field label="Amount" htmlFor="rec-amount">
          <TextInput
            id="rec-amount"
            type="number"
            min="1"
            value={form.amount}
            onChange={(event) => setForm({...form, amount: event.target.value})}
            required
          />
        </Field>
        <Field label="Purpose" htmlFor="rec-purpose">
          <Select
            id="rec-purpose"
            options={PURPOSES}
            value={form.purpose}
            onChange={(event) => setForm({...form, purpose: event.target.value})}
          />
        </Field>
        <Field label="Payment method" htmlFor="rec-method">
          <Select
            id="rec-method"
            placeholder="Not recorded"
            options={(methods.state.data?.items ?? []).map((m) => ({value: m.id, label: m.name}))}
            value={form.paymentMethodId}
            onChange={(event) => setForm({...form, paymentMethodId: event.target.value})}
          />
        </Field>
        <Field label="Period covered from" htmlFor="rec-from">
          <TextInput
            id="rec-from"
            type="date"
            value={form.periodStart}
            onChange={(event) => setForm({...form, periodStart: event.target.value})}
          />
        </Field>
        <Field label="Period covered to" htmlFor="rec-to">
          <TextInput
            id="rec-to"
            type="date"
            value={form.periodEnd}
            onChange={(event) => setForm({...form, periodEnd: event.target.value})}
          />
        </Field>
        <Field label="Notes" htmlFor="rec-notes">
          <TextArea
            id="rec-notes"
            value={form.notes}
            onChange={(event) => setForm({...form, notes: event.target.value})}
          />
        </Field>
        <div className={fieldStyles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Record collection'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * One collection, end to end: who paid, how it was split, what the provider
 * said, and what it posted to the ledger. The two ways it can be settled are
 * offered here because this is where the evidence for either one is visible.
 */
function PaymentDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const api = useAdminApi();
  const {state, refresh} = useResource(() => api.getPayment(id), `payment-${id}`);
  const payment = state.data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState('');

  async function act(work: Promise<PaymentDetail>) {
    setBusy(true);
    setError(null);
    try {
      await work;
      refresh();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That could not be recorded');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={payment ? `Collection ${payment.reference}` : 'Collection'}
      description={payment?.property_title ?? undefined}
      onClose={onClose}
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}
      {state.status === 'error' && (
        <div className={fieldStyles.errorBlock} role="alert">{state.error}</div>
      )}
      {!payment && state.status === 'loading' && <p className={styles.muted}>Loading…</p>}

      {payment && (
        <>
          <DetailGrid
            items={[
              {label: 'Status', value: <StatusBadge status={payment.status} />},
              {label: 'Amount', value: money(payment.amount, payment.currency)},
              {label: 'Purpose', value: humanise(payment.purpose)},
              {label: 'Paid by', value: payment.payer_name ?? '—'},
              {label: 'Method', value: payment.payment_method_name ?? '—'},
              {label: 'Provider reference', value: payment.provider_reference ?? '—'},
              {
                label: 'Period',
                value:
                  payment.period_start && payment.period_end
                    ? `${payment.period_start} → ${payment.period_end}`
                    : '—',
              },
              {
                label: 'Confirmed',
                value: payment.confirmed_at
                  ? `${new Date(payment.confirmed_at).toLocaleString()} by ${payment.confirmed_by ?? 'unknown'}`
                  : '—',
              },
              {label: 'Failure reason', value: payment.failure_reason ?? '—'},
            ]}
          />

          {payment.status === 'pending' && (
            <div className={styles.actionBar}>
              <p className={styles.muted}>
                A collection is settled by a provider confirmation. Where there is none — cash, a
                bank transfer — a finance officer reconciles it, and that decision is recorded
                against their name.
              </p>
              <div className={styles.actionButtons}>
                <Button size="small" onClick={() => act(api.reconcilePayment(payment.id))} disabled={busy}>
                  Reconcile as received
                </Button>
                <Button size="small" variant="outline" onClick={() => setFailing(true)} disabled={busy}>
                  Mark failed
                </Button>
              </div>
            </div>
          )}

          {failing && (
            <div className={styles.actionBar}>
              <Field label="Why did this collection fail?" htmlFor="pay-fail-reason">
                <TextArea
                  id="pay-fail-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
              <div className={styles.actionButtons}>
                <Button size="small" variant="outline" onClick={() => setFailing(false)}>Cancel</Button>
                <Button
                  size="small"
                  variant="danger"
                  disabled={busy}
                  onClick={() => act(api.failPayment(payment.id, {reason})).then(() => setFailing(false))}
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}

          <p className={styles.sectionTitle}>How it is split</p>
          <ul className={styles.rows}>
            {payment.splits.map((split) => (
              <li key={split.id} className={styles.row}>
                <span>
                  {humanise(split.beneficiary_type)}
                  {split.beneficiary_name && ` · ${split.beneficiary_name}`}
                  {split.percentage && ` · ${split.percentage}%`}
                </span>
                <span className={styles.rowRight}>
                  {money(split.amount, payment.currency)}
                  {split.payout_reference ? (
                    <StatusBadge status={split.payout_status ?? 'scheduled'} />
                  ) : (
                    payment.status === 'successful' && <StatusBadge status="unpaid" />
                  )}
                </span>
              </li>
            ))}
          </ul>

          <p className={styles.sectionTitle}>What the provider sent</p>
          {payment.providerEvents.length === 0 ? (
            <p className={styles.muted}>No provider callbacks have arrived for this collection.</p>
          ) : (
            <ul className={styles.rows}>
              {payment.providerEvents.map((event) => (
                <li key={event.id} className={styles.row}>
                  <span>
                    {event.provider} · {event.status}
                    {event.provider_reference && ` · ${event.provider_reference}`}
                  </span>
                  <span className={styles.rowRight}>
                    {new Date(event.received_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className={styles.sectionTitle}>Ledger</p>
          {payment.ledger.length === 0 ? (
            <p className={styles.muted}>Nothing has posted yet — the ledger is written when the money lands.</p>
          ) : (
            <ul className={styles.rows}>
              {payment.ledger.map((entry) => (
                <li key={entry.id} className={styles.row}>
                  <span><code>{entry.account}</code> · {entry.direction}</span>
                  <span className={styles.rowRight}>{money(entry.amount, entry.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
