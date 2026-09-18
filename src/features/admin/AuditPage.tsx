import {useAdminApi} from '../../api/AdminApiContext';
import type {AuditEntry} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {useListFilters} from '../../hooks/useListFilters';
import {
  Card, DataTable, Field, FilterBar, PageSection, Pagination, Select, StatusBadge, TextInput, humanise, fieldStyles,
} from '../../components/ui';

const TABLES = [
  {value: 'users', label: 'Users'},
  {value: 'properties', label: 'Properties'},
  {value: 'organizations', label: 'Organizations'},
  {value: 'dictionary_items', label: 'Dictionaries'},
  {value: 'settings', label: 'Settings'},
];

/**
 * The audit trail is written entirely by database triggers, so this screen is
 * a pure read — nothing in the app decides what gets recorded.
 */
export function AuditPage() {
  const api = useAdminApi();
  const {filters, setFilter, offset, setOffset, key, limit} = useListFilters({tableName: '', actor: ''});
  const {state, refresh} = useResource(() => api.auditLog({...filters, limit, offset}), key);

  return (
    <PageSection
      title="Audit log"
      description="Every create, update and delete across the platform, recorded by the database itself."
    >
      <Card>
        <FilterBar>
          <Field label="Record type" htmlFor="audit-table">
            <Select
              id="audit-table"
              placeholder="All record types"
              options={TABLES}
              value={filters.tableName}
              onChange={(event) => setFilter('tableName', event.target.value)}
            />
          </Field>
          <Field label="Actor" htmlFor="audit-actor" className={fieldStyles.searchField}>
            <TextInput
              id="audit-actor"
              placeholder="admin@homemate.co.tz"
              value={filters.actor}
              onChange={(event) => setFilter('actor', event.target.value)}
            />
          </Field>
        </FilterBar>
      </Card>

      <Card>
        <DataTable<AuditEntry>
          status={state.status}
          error={state.status === 'error' ? state.error : undefined}
          onRetry={refresh}
          rows={state.data?.items ?? []}
          emptyMessage="No audit entries match these filters."
          columns={[
            {key: 'when', header: 'When', render: (entry) => new Date(entry.created_at).toLocaleString()},
            {key: 'subject', header: 'Subject', render: (entry) => entry.subject ?? entry.record_id},
            {key: 'type', header: 'Record', render: (entry) => humanise(entry.table_name)},
            {key: 'operation', header: 'Action', render: (entry) => humanise(entry.operation)},
            {
              key: 'fields',
              header: 'Changed',
              render: (entry) => (entry.changed_fields?.length ? entry.changed_fields.join(', ') : '—'),
            },
            {key: 'status', header: 'Status', render: (entry) => <StatusBadge status={entry.status} />},
            {key: 'actor', header: 'Actor', render: (entry) => entry.actor ?? 'system'},
          ]}
        />
        {state.data && (
          <Pagination total={state.data.pagination.total} limit={limit} offset={offset} onChange={setOffset} />
        )}
      </Card>
    </PageSection>
  );
}
