import {useAdminApi} from '../../api/AdminApiContext';
import type {LedgerEntry} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {useListFilters} from '../../hooks/useListFilters';
import {Card, DataTable, Field, FilterBar, Pagination, Select} from '../../components/ui';
import {money} from './CollectionsTab';
import styles from './MoneyTabs.module.css';

const ACCOUNTS = [
  {value: 'cash.collections', label: 'Cash · collections'},
  {value: 'cash.disbursements', label: 'Cash · disbursements'},
  {value: 'revenue.commission', label: 'Revenue · commission'},
  {value: 'liability.payable.landlord', label: 'Payable · landlord'},
  {value: 'liability.payable.broker', label: 'Payable · broker'},
  {value: 'liability.payable.agency', label: 'Payable · agency'},
];

/**
 * The ledger, as written. Nothing here is editable and nothing here is
 * computed in the browser: every line was posted by a database trigger when a
 * collection settled or a payout was released, and a correction is another
 * entry rather than a change to this one.
 */
export function LedgerTab() {
  const api = useAdminApi();
  const {filters, setFilter, offset, setOffset, key, limit} = useListFilters({account: ''});
  const {state, refresh} = useResource(
    () => api.listLedger({...filters, limit, offset}),
    `ledger-${key}`
  );

  return (
    <Card>
      <p className={styles.muted}>
        Append-only. A mistake is corrected with a compensating entry, never by editing what is
        already recorded.
      </p>
      <FilterBar>
        <Field label="Account" htmlFor="ledger-account">
          <Select
            id="ledger-account"
            placeholder="All accounts"
            options={ACCOUNTS}
            value={filters.account}
            onChange={(event) => setFilter('account', event.target.value)}
          />
        </Field>
      </FilterBar>

      <DataTable<LedgerEntry>
        status={state.status}
        error={state.status === 'error' ? state.error : undefined}
        onRetry={refresh}
        rows={state.data?.items ?? []}
        emptyMessage="Nothing has posted to the ledger yet."
        columns={[
          {key: 'date', header: 'Posted', render: (e) => new Date(e.entry_date).toLocaleString()},
          {key: 'account', header: 'Account', render: (e) => <code>{e.account}</code>},
          {key: 'direction', header: 'Direction', render: (e) => e.direction},
          {key: 'amount', header: 'Amount', render: (e) => money(e.amount, e.currency)},
          {key: 'description', header: 'Description', render: (e) => e.description ?? '—'},
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
  );
}
