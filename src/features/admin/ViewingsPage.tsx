import {useState} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import type {Viewing} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {useListFilters} from '../../hooks/useListFilters';
import {
  Button, Card, ConfirmDialog, DataTable, Field, FilterBar, PageSection,
  Pagination, RowActions, Select, StatusBadge, fieldStyles,
} from '../../components/ui';
import {useAdminSearch} from './searchContext';
import {useAttention} from './attentionContext';

const STATUSES = [
  {value: 'requested', label: 'Requested'},
  {value: 'confirmed', label: 'Confirmed'},
  {value: 'completed', label: 'Completed'},
  {value: 'cancelled', label: 'Cancelled'},
  {value: 'no_show', label: 'No show'},
];

/** Which moves a viewing may make next — the same ladder the database enforces. */
const NEXT: Record<string, {status: string; label: string; reason?: string; destructive?: boolean}[]> = {
  requested: [
    {status: 'confirmed', label: 'Confirm'},
    {status: 'cancelled', label: 'Cancel', reason: 'Why is it cancelled?', destructive: true},
  ],
  confirmed: [
    {status: 'completed', label: 'Mark done'},
    {status: 'no_show', label: 'No show'},
    {status: 'cancelled', label: 'Cancel', reason: 'Why is it cancelled?', destructive: true},
  ],
  rescheduled: [{status: 'confirmed', label: 'Confirm'}],
  completed: [],
  cancelled: [],
  no_show: [],
};

/**
 * Appointments customers have asked for. A request sitting here is somebody
 * planning their week around an answer, so it badges the sidebar until it is
 * confirmed or turned down.
 */
export function ViewingsPage() {
  const api = useAdminApi();
  const attention = useAttention();
  const {filters, setFilter, offset, setOffset, key, limit} = useListFilters({status: ''});
  const searchTerm = useAdminSearch('Reference, property or customer');
  const [decision, setDecision] = useState<{viewing: Viewing; move: {status: string; label: string; reason?: string; destructive?: boolean}} | null>(null);

  const {state, refresh} = useResource(
    () => api.listViewings({...filters, query: searchTerm || undefined, limit, offset}),
    `viewings-${searchTerm}-${key}`
  );

  return (
    <PageSection
      title="Viewings"
      description="Appointments customers have asked for, and whether they are confirmed."
    >
      <Card>
        <FilterBar>
          <Field label="Status" htmlFor="viewing-status">
            <Select
              id="viewing-status"
              placeholder="All statuses"
              options={STATUSES}
              value={filters.status}
              onChange={(event) => setFilter('status', event.target.value)}
            />
          </Field>
        </FilterBar>
      </Card>

      <Card>
        <DataTable<Viewing>
          status={state.status}
          error={state.status === 'error' ? state.error : undefined}
          onRetry={refresh}
          rows={state.data?.items ?? []}
          emptyMessage="No viewings match these filters."
          columns={[
            {key: 'reference', header: 'Reference', render: (v) => <code>{v.reference}</code>},
            {
              key: 'when',
              header: 'When',
              render: (v) => (
                <span className={fieldStyles.inlineStack}>
                  <span>{new Date(v.scheduled_for).toLocaleString()}</span>
                  {v.is_upcoming && <span>upcoming</span>}
                </span>
              ),
            },
            {key: 'property', header: 'Property', render: (v) => v.property_title},
            {
              key: 'customer',
              header: 'Customer',
              render: (v) => (
                <span className={fieldStyles.inlineStack}>
                  <span>{v.customer_name ?? '—'}</span>
                  <span>{v.customer_phone ?? ''}</span>
                </span>
              ),
            },
            {key: 'host', header: 'Host', render: (v) => v.host_name ?? '—'},
            {
              key: 'status',
              header: 'Status',
              render: (v) => (
                <span className={fieldStyles.inlineStack}>
                  <StatusBadge status={v.status} />
                  {v.cancellation_reason && <span>{v.cancellation_reason}</span>}
                </span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (viewing) => (
                <RowActions>
                  {(NEXT[viewing.status] ?? []).map((move) => (
                    <Button
                      key={move.status}
                      variant={move.destructive ? 'ghost' : 'outline'}
                      size="small"
                      onClick={() => setDecision({viewing, move})}
                    >
                      {move.label}
                    </Button>
                  ))}
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

      {decision && (
        <ConfirmDialog
          title={`${decision.move.label} ${decision.viewing.reference}?`}
          description={
            decision.move.status === 'confirmed'
              ? 'The customer is told the time is confirmed and given the host’s number.'
              : 'The customer is notified.'
          }
          confirmLabel={decision.move.label}
          destructive={decision.move.destructive}
          reasonLabel={decision.move.reason}
          onCancel={() => setDecision(null)}
          onConfirm={async (reason) => {
            await api.changeViewingStatus(decision.viewing.id, {
              status: decision.move.status,
              reason,
            });
            setDecision(null);
            refresh();
            attention.refresh();
          }}
        />
      )}
    </PageSection>
  );
}
