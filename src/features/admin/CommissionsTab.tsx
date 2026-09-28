import {useAdminApi} from '../../api/AdminApiContext';
import type {CommissionRow} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {useListFilters} from '../../hooks/useListFilters';
import {Card, DataTable, Field, FilterBar, Pagination, Select, StatusBadge, humanise} from '../../components/ui';
import {money} from './CollectionsTab';
import styles from './MoneyTabs.module.css';

const SETTLED = [
  {value: 'true', label: 'Verified — commission earned'},
  {value: 'false', label: 'Not verified yet'},
];

/**
 * Listing commissions.
 *
 * Every placement carries one tenant fee — a configured share of one month's
 * rent, charged in the customer's first payment instead of the usual month's
 * agent fee. HomeMate keeps its configured share of that fee, and the broker
 * or agency who listed the home gets the rest (the landlord, when they listed
 * it themselves). Rent is never commissioned, so this table is the whole of
 * HomeMate's placement revenue, row by row.
 */
export function CommissionsTab({searchTerm}: {searchTerm: string}) {
  const api = useAdminApi();
  const {filters, setFilter, offset, setOffset, key, limit} = useListFilters({settled: ''});
  const {state, refresh} = useResource(
    () => api.listCommissions({...filters, query: searchTerm || undefined, limit, offset}),
    `commissions-${searchTerm}-${key}`
  );
  const totals = state.data?.totals;

  return (
    <Card>
      <p className={styles.muted}>
        HomeMate’s commission comes only from the tenant fee — never from rent or deposits. A
        commission is earned once the payment it arrived in has been verified.
      </p>

      <dl className={styles.commissionTotals}>
        <div>
          <dt>Tenant fees charged</dt>
          <dd>{money(totals?.fees)}</dd>
          <span>{totals?.placements ?? 0} placements</span>
        </div>
        <div>
          <dt>HomeMate commission</dt>
          <dd>{money(totals?.platform)}</dd>
          <span>{money(totals?.platform_settled)} verified</span>
        </div>
        <div>
          <dt>Agents’ share</dt>
          <dd>{money(totals?.agents)}</dd>
          <span>Paid out with the landlord’s money</span>
        </div>
      </dl>

      <FilterBar>
        <Field label="Payment" htmlFor="commission-settled">
          <Select
            id="commission-settled"
            placeholder="All placements"
            options={SETTLED}
            value={filters.settled}
            onChange={(event) => setFilter('settled', event.target.value)}
          />
        </Field>
      </FilterBar>

      <DataTable<CommissionRow>
        status={state.status}
        error={state.status === 'error' ? state.error : undefined}
        onRetry={refresh}
        rows={state.data?.items ?? []}
        emptyMessage="No placements have carried a tenant fee yet."
        columns={[
          {key: 'reference', header: 'Reference', render: (row) => <code>{row.reference}</code>},
          {
            key: 'listing',
            header: 'Listing',
            render: (row) => (
              <span className={styles.stack}>
                <span>{row.property_title}</span>
                <span className={styles.subtle}>{row.customer_name ?? '—'}</span>
              </span>
            ),
          },
          {key: 'rent', header: 'Monthly rent', render: (row) => money(row.monthly_rent, row.currency)},
          {
            key: 'fee',
            header: 'Tenant fee',
            render: (row) => (
              <span className={styles.stack}>
                <span>{money(row.service_fee, row.currency)}</span>
                <span className={styles.subtle}>{Number(row.service_fee_percentage ?? 0)}% of a month</span>
              </span>
            ),
          },
          {
            key: 'platform',
            header: 'HomeMate',
            render: (row) => (
              <span className={styles.stack}>
                <strong>{money(row.platform_fee, row.currency)}</strong>
                <span className={styles.subtle}>{Number(row.platform_fee_percentage ?? 0)}% of the fee</span>
              </span>
            ),
          },
          {
            key: 'agent',
            header: 'Listing agent',
            render: (row) => (
              <span className={styles.stack}>
                <span>{money(row.agent_fee, row.currency)}</span>
                <span className={styles.subtle}>
                  {row.agent_name ? `${row.agent_name} · ${humanise(row.agent_type ?? '')}` : 'Landlord (listed directly)'}
                </span>
              </span>
            ),
          },
          {
            key: 'settled',
            header: 'Payment',
            render: (row) => <StatusBadge status={row.settled ? 'verified' : 'pending'} />,
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
  );
}
