import {useState} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import type {OutstandingBalance, Payout, PayoutDetail} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {useListFilters} from '../../hooks/useListFilters';
import {
  Button, Card, DataTable, DetailGrid, Field, FilterBar, Modal, Pagination,
  RowActions, Select, StatusBadge, TextArea, humanise, fieldStyles,
} from '../../components/ui';
import {money} from './CollectionsTab';
import styles from './MoneyTabs.module.css';

const STATUSES = [
  {value: 'scheduled', label: 'Scheduled'},
  {value: 'processing', label: 'Processing'},
  {value: 'paid', label: 'Paid'},
  {value: 'on_hold', label: 'On hold'},
  {value: 'failed', label: 'Failed'},
  {value: 'cancelled', label: 'Cancelled'},
];

const BENEFICIARY_TYPES = [
  {value: 'landlord', label: 'Landlord'},
  {value: 'broker', label: 'Broker'},
  {value: 'agency', label: 'Agency'},
];

/** Which moves a payout may make next — the same ladder the database enforces. */
const NEXT_STATUSES: Record<string, {status: string; label: string; reason?: string; destructive?: boolean}[]> = {
  scheduled: [
    {status: 'processing', label: 'Send to provider'},
    {status: 'on_hold', label: 'Hold', reason: 'Why is this being held?'},
    {status: 'cancelled', label: 'Cancel', destructive: true},
  ],
  processing: [
    {status: 'paid', label: 'Mark paid'},
    {status: 'failed', label: 'Mark failed', reason: 'Why did it fail?', destructive: true},
    {status: 'on_hold', label: 'Hold', reason: 'Why is this being held?'},
  ],
  on_hold: [
    {status: 'scheduled', label: 'Release hold'},
    {status: 'cancelled', label: 'Cancel', destructive: true},
  ],
  failed: [
    {status: 'scheduled', label: 'Retry'},
    {status: 'cancelled', label: 'Cancel', destructive: true},
  ],
  paid: [],
  cancelled: [],
};

/**
 * Money going out. HomeMate holds rent only in transit: what a tenant paid
 * belongs to the landlord, the broker and the agency, less the commission.
 *
 * Two lists, because they answer two different questions — "who are we holding
 * money for" and "what have we sent" — and a payout is created from the first
 * by claiming the shares it settles, so the same rent cannot be paid twice.
 */
export function DisbursementsTab({searchTerm, onChanged}: {searchTerm: string; onChanged: () => void}) {
  const api = useAdminApi();
  const {filters, setFilter, offset, setOffset, key, limit} = useListFilters({
    status: '', beneficiaryType: '',
  });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balances = useResource(() => api.outstandingBalances(), 'outstanding-balances');
  const payouts = useResource(
    () => api.listPayouts({...filters, query: searchTerm || undefined, limit, offset}),
    `payouts-${searchTerm}-${key}`
  );

  function reload() {
    balances.refresh();
    payouts.refresh();
    onChanged();
  }

  async function pay(balance: OutstandingBalance) {
    setBusy(true);
    setError(null);
    try {
      await api.createPayout({
        beneficiaryType: balance.beneficiary_type,
        beneficiaryUserId: balance.beneficiary_user_id,
      });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that payout');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}

      <Card>
        <h3 className={styles.cardTitle}>Owed right now</h3>
        <p className={styles.muted}>
          Collected rent that has not yet been sent on. Paying a beneficiary gathers every share
          they are owed into one payout.
        </p>
        <DataTable<OutstandingBalance & {id: string}>
          status={balances.state.status}
          error={balances.state.status === 'error' ? balances.state.error : undefined}
          onRetry={balances.refresh}
          rows={(balances.state.data?.items ?? []).map((row) => ({
            ...row,
            // the pairing of who and in what capacity is what identifies a balance
            id: `${row.beneficiary_type}:${row.beneficiary_user_id}`,
          }))}
          emptyMessage="Nothing is owed — every collection has been passed on."
          columns={[
            {key: 'name', header: 'Beneficiary', render: (row) => row.beneficiary_name ?? '—'},
            {key: 'type', header: 'As', render: (row) => humanise(row.beneficiary_type)},
            {
              key: 'kyc',
              header: 'Identity',
              render: (row) => <StatusBadge status={row.beneficiary_kyc_status ?? 'not_started'} />,
            },
            {
              key: 'destination',
              header: 'Send to',
              render: (row) => row.mobile_money_number ?? row.bank_account_number ?? '— none on file',
            },
            {key: 'collections', header: 'Collections', render: (row) => row.split_count},
            {key: 'amount', header: 'Owed', render: (row) => money(row.amount_due)},
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (row) => (
                <RowActions>
                  <Button size="small" onClick={() => pay(row)} disabled={busy}>
                    Pay out
                  </Button>
                </RowActions>
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <h3 className={styles.cardTitle}>Payouts</h3>
        <FilterBar>
          <Field label="Status" htmlFor="payout-status">
            <Select
              id="payout-status"
              placeholder="All statuses"
              options={STATUSES}
              value={filters.status}
              onChange={(event) => setFilter('status', event.target.value)}
            />
          </Field>
          <Field label="Beneficiary" htmlFor="payout-type">
            <Select
              id="payout-type"
              placeholder="Anyone"
              options={BENEFICIARY_TYPES}
              value={filters.beneficiaryType}
              onChange={(event) => setFilter('beneficiaryType', event.target.value)}
            />
          </Field>
        </FilterBar>

        <DataTable<Payout>
          status={payouts.state.status}
          error={payouts.state.status === 'error' ? payouts.state.error : undefined}
          onRetry={payouts.refresh}
          rows={payouts.state.data?.items ?? []}
          emptyMessage="No payouts match these filters."
          columns={[
            {key: 'reference', header: 'Reference', render: (p) => <code>{p.reference}</code>},
            {key: 'beneficiary', header: 'Beneficiary', render: (p) => p.beneficiary_name ?? '—'},
            {key: 'type', header: 'As', render: (p) => humanise(p.beneficiary_type)},
            {key: 'amount', header: 'Amount', render: (p) => money(p.amount, p.currency)},
            {
              key: 'status',
              header: 'Status',
              render: (p) => (
                <span className={fieldStyles.inlineStack}>
                  <StatusBadge status={p.status} />
                  {p.hold_reason && <span>{p.hold_reason}</span>}
                  {p.failure_reason && <span>{p.failure_reason}</span>}
                </span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (payout) => (
                <RowActions>
                  <Button variant="ghost" size="small" onClick={() => setDetailId(payout.id)}>
                    View
                  </Button>
                </RowActions>
              ),
            },
          ]}
        />
        {payouts.state.data && (
          <Pagination
            total={payouts.state.data.pagination.total}
            limit={limit}
            offset={offset}
            onChange={setOffset}
          />
        )}
      </Card>

      {detailId && (
        <PayoutDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={reload} />
      )}
    </>
  );
}

function PayoutDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const api = useAdminApi();
  const {state, refresh} = useResource(() => api.getPayout(id), `payout-${id}`);
  const payout = state.data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{status: string; label: string; reason?: string} | null>(null);
  const [reason, setReason] = useState('');

  async function move(status: string, withReason?: string) {
    setBusy(true);
    setError(null);
    try {
      await api.changePayoutStatus(id, {status, reason: withReason});
      setPending(null);
      setReason('');
      refresh();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That move was refused');
    } finally {
      setBusy(false);
    }
  }

  const nextMoves: {status: string; label: string; reason?: string; destructive?: boolean}[] =
    payout ? (NEXT_STATUSES[payout.status] ?? []) : [];

  return (
    <Modal
      title={payout ? `Payout ${payout.reference}` : 'Payout'}
      description={payout?.beneficiary_name ?? undefined}
      onClose={onClose}
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}
      {state.status === 'error' && (
        <div className={fieldStyles.errorBlock} role="alert">{state.error}</div>
      )}
      {!payout && state.status === 'loading' && <p className={styles.muted}>Loading…</p>}

      {payout && (
        <>
          <DetailGrid
            items={[
              {label: 'Status', value: <StatusBadge status={payout.status} />},
              {label: 'Amount', value: money(payout.amount, payout.currency)},
              {label: 'Beneficiary', value: `${payout.beneficiary_name ?? '—'} (${humanise(payout.beneficiary_type)})`},
              {
                label: 'Identity',
                value: <StatusBadge status={payout.beneficiary_kyc_status ?? 'not_started'} />,
              },
              {label: 'Sent to', value: payout.destination ?? '— none on file'},
              {label: 'Provider reference', value: payout.provider_reference ?? '—'},
              {label: 'Scheduled for', value: payout.scheduled_for ?? '—'},
              {
                label: 'Released',
                value: payout.paid_at
                  ? `${new Date(payout.paid_at).toLocaleString()} by ${payout.approved_by ?? 'unknown'}`
                  : '—',
              },
              {label: 'Hold reason', value: payout.hold_reason ?? '—'},
              {label: 'Failure reason', value: payout.failure_reason ?? '—'},
            ]}
          />

          {payout.hold_reason && (
            <p className={styles.warning}>
              This payout is held: {payout.hold_reason}. Put that right on the beneficiary's
              record, then release the hold.
            </p>
          )}

          {nextMoves.length > 0 && (
            <div className={styles.actionBar}>
              <div className={styles.actionButtons}>
                {nextMoves.map((move_) => (
                  <Button
                    key={move_.status}
                    size="small"
                    variant={move_.destructive ? 'outline' : 'primary'}
                    disabled={busy}
                    onClick={() => (move_.reason ? setPending(move_) : move(move_.status))}
                  >
                    {move_.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {pending && (
            <div className={styles.actionBar}>
              <Field label={pending.reason ?? 'Reason'} htmlFor="payout-reason">
                <TextArea
                  id="payout-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
              <div className={styles.actionButtons}>
                <Button size="small" variant="outline" onClick={() => setPending(null)}>Cancel</Button>
                <Button size="small" disabled={busy} onClick={() => move(pending.status, reason)}>
                  Confirm
                </Button>
              </div>
            </div>
          )}

          <p className={styles.sectionTitle}>Collections it settles</p>
          {payout.splits.length === 0 ? (
            <p className={styles.muted}>No collections are attached to this payout.</p>
          ) : (
            <ul className={styles.rows}>
              {payout.splits.map((split) => (
                <li key={split.id} className={styles.row}>
                  <span>
                    <code>{split.payment_reference}</code>
                    {split.property_title && ` · ${split.property_title}`}
                  </span>
                  <span className={styles.rowRight}>{money(split.amount, payout.currency)}</span>
                </li>
              ))}
            </ul>
          )}

          <p className={styles.sectionTitle}>Ledger</p>
          {payout.ledger.length === 0 ? (
            <p className={styles.muted}>Nothing posts until the payout is released.</p>
          ) : (
            <ul className={styles.rows}>
              {payout.ledger.map((entry) => (
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

export type {PayoutDetail};
