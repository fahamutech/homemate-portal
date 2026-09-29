import {useState} from 'react';
import type {FormEvent} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import {CONFIRMATION_LABEL} from './partners/labels';
import {ListedByCell} from './partners/ListedBy';
import type {AdminProperty} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {useListFilters} from '../../hooks/useListFilters';
import {
  Button, Card, ConfirmDialog, DataTable, Field, FilterBar, Modal,
  PageSection, Pagination, RowActions, Select, StatusBadge, TextInput, humanise, fieldStyles,
} from '../../components/ui';
import {useAdminSearch} from './searchContext';
import {PropertyFormModal} from './PropertyFormModal';
import {PropertyDetailModal} from './PropertyDetailModal';
import {AuthedImage} from './AuthedImage';
import styles from './PropertiesPage.module.css';

const STATUSES = [
  {value: 'draft', label: 'Draft'},
  {value: 'pending_review', label: 'Pending review'},
  {value: 'approved', label: 'Approved'},
  {value: 'changes_requested', label: 'Changes requested'},
  {value: 'rejected', label: 'Rejected'},
  {value: 'suspended', label: 'Suspended'},
  {value: 'archived', label: 'Archived'},
];

const LISTING_TYPES = [
  {value: 'rent', label: 'For rent'},
  {value: 'sale', label: 'For sale'},
];

const FURNISHING = [
  {value: 'unfurnished', label: 'Unfurnished'},
  {value: 'semi_furnished', label: 'Semi furnished'},
  {value: 'fully_furnished', label: 'Fully furnished'},
];

/**
 * Moderation decisions available from each state. This mirrors the transition
 * map the database enforces (migrations/003_triggers.sql) so the UI only ever
 * offers moves the server will accept — and the server still refuses anything
 * else if the two ever drift.
 */
const ACTIONS_BY_STATUS: Record<string, {status: string; label: string; destructive?: boolean; reason?: string}[]> = {
  draft: [{status: 'pending_review', label: 'Submit for review'}],
  pending_review: [
    {status: 'approved', label: 'Approve'},
    {status: 'changes_requested', label: 'Request changes', reason: 'What needs to change?'},
    {status: 'rejected', label: 'Reject', destructive: true, reason: 'Rejection reason'},
  ],
  changes_requested: [{status: 'pending_review', label: 'Resubmit'}],
  rejected: [{status: 'pending_review', label: 'Resubmit'}],
  approved: [{status: 'suspended', label: 'Suspend', destructive: true}],
  suspended: [{status: 'approved', label: 'Restore'}],
  archived: [],
};

type Decision = {property: AdminProperty; action: {status: string; label: string; destructive?: boolean; reason?: string}};

function formatPrice(property: AdminProperty) {
  if (!property.price) return '—';
  return `${property.currency} ${Number(property.price).toLocaleString()}`;
}

export function PropertiesPage() {
  const api = useAdminApi();
  const {filters, setFilter, offset, setOffset, key, limit} = useListFilters({
    status: '', listingType: '', furnishing: '', latitude: '', longitude: '', radiusMetres: '',
  });
  const searchTerm = useAdminSearch('Title or reference code');
  const [geoOpen, setGeoOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // the debounced top-bar term participates in the resource key, so typing
  // issues one request once you stop, and paging resets when it changes
  const {state, refresh} = useResource(
    () => api.listProperties({...filters, query: searchTerm || undefined, limit, offset}),
    `${searchTerm}-${key}`
  );
  const rows = state.data?.items ?? [];
  const geoActive = Boolean(filters.latitude && filters.longitude && filters.radiusMetres);

  return (
    <PageSection
      title="Property registry"
      description="Review submissions, approve listings and keep the registry clean."
      actions={
        <>
          <Button variant="outline" onClick={() => setGeoOpen(true)}>
            {geoActive ? 'Location filter: on' : 'Search by location'}
          </Button>
          <Button onClick={() => setCreating(true)}>Add property</Button>
        </>
      }
    >
      <Card>
        <FilterBar>
          <Field label="Status" htmlFor="property-status">
            <Select
              id="property-status"
              placeholder="All statuses"
              options={STATUSES}
              value={filters.status}
              onChange={(event) => setFilter('status', event.target.value)}
            />
          </Field>
          <Field label="Listing type" htmlFor="property-listing-type">
            <Select
              id="property-listing-type"
              placeholder="All types"
              options={LISTING_TYPES}
              value={filters.listingType}
              onChange={(event) => setFilter('listingType', event.target.value)}
            />
          </Field>
          <Field label="Furnishing" htmlFor="property-furnishing">
            <Select
              id="property-furnishing"
              placeholder="Any furnishing"
              options={FURNISHING}
              value={filters.furnishing}
              onChange={(event) => setFilter('furnishing', event.target.value)}
            />
          </Field>
        </FilterBar>
        {geoActive && (
          <p className={fieldStyles.paginationInfo} style={{marginTop: 'var(--space-lg)'}}>
            Showing listings within {Number(filters.radiusMetres).toLocaleString()} m of{' '}
            {filters.latitude}, {filters.longitude}.{' '}
            <Button
              variant="ghost"
              size="small"
              onClick={() => {
                setFilter('latitude', '');
                setFilter('longitude', '');
                setFilter('radiusMetres', '');
              }}
            >
              Clear
            </Button>
          </p>
        )}
      </Card>

      <Card>
        <DataTable<AdminProperty>
          status={state.status}
          error={state.status === 'error' ? state.error : undefined}
          onRetry={refresh}
          rows={rows}
          emptyMessage="No properties match these filters."
          columns={[
            {
              key: 'cover',
              header: 'Photo',
              render: (p) =>
                p.cover_media_id
                  ? <AuthedImage source={{kind: 'media', id: p.cover_media_id}} thumbnail alt={p.title} className={styles.coverThumb} />
                  : <span className={styles.coverEmpty} aria-hidden="true" />,
            },
            {key: 'reference', header: 'Reference', render: (p) => p.reference_code},
            {key: 'title', header: 'Title', render: (p) => p.title},
            {key: 'location', header: 'Location', render: (p) => [p.ward_name, p.region_name].filter(Boolean).join(', ') || '—'},
            {key: 'type', header: 'Type', render: (p) => `${p.property_type_name ?? '—'} · ${humanise(p.listing_type)}`},
            {key: 'price', header: 'Rent', render: formatPrice},
            {
              key: 'total',
              header: 'Total / month',
              render: (p) => (p.total_monthly_cost ? `${p.currency} ${Number(p.total_monthly_cost).toLocaleString()}` : '—'),
            },
            {key: 'listedBy', header: 'Listed by', render: (p) => <ListedByCell property={p} />},
            {
              key: 'confirmation',
              header: 'Landlord',
              render: (p) => {
                const confirmation = p.landlord_confirmation;
                if (!confirmation) return '—';
                return (
                  <span title={confirmation.reason ?? undefined}>
                    <StatusBadge status={confirmation.status} label={CONFIRMATION_LABEL[confirmation.status]} />
                  </span>
                );
              },
            },
            {key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} />},
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (property) => (
                <RowActions>
                  <Button variant="ghost" size="small" onClick={() => setDetailId(property.id)}>View</Button>
                  <Button variant="ghost" size="small" onClick={() => setEditingId(property.id)}>Edit</Button>
                  {(ACTIONS_BY_STATUS[property.status] ?? []).map((action) => (
                    <Button
                      key={action.status}
                      variant="outline"
                      size="small"
                      onClick={() => setDecision({property, action})}
                    >
                      {action.label}
                    </Button>
                  ))}
                </RowActions>
              ),
            },
          ]}
        />
        {state.data && (
          <Pagination total={state.data.pagination.total} limit={limit} offset={offset} onChange={setOffset} />
        )}
      </Card>

      {geoOpen && (
        <LocationFilterModal
          initial={{
            latitude: filters.latitude,
            longitude: filters.longitude,
            radiusMetres: filters.radiusMetres || '5000',
          }}
          onClose={() => setGeoOpen(false)}
          onApply={({latitude, longitude, radiusMetres}) => {
            setFilter('latitude', latitude);
            setFilter('longitude', longitude);
            setFilter('radiusMetres', radiusMetres);
            setGeoOpen(false);
          }}
        />
      )}

      {decision && (
        <ModerationDialog
          decision={decision}
          onClose={() => setDecision(null)}
          onDone={() => {
            setDecision(null);
            refresh();
          }}
        />
      )}

      {(creating || editingId) && (
        <PropertyFormModal
          // keyed by target so switching rows remounts with fresh state
          key={editingId ?? 'new'}
          propertyId={editingId ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditingId(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditingId(null);
            refresh();
          }}
        />
      )}

      {detailId && <PropertyDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </PageSection>
  );
}

function LocationFilterModal({
  initial,
  onClose,
  onApply,
}: {
  initial: {latitude: string; longitude: string; radiusMetres: string};
  onClose: () => void;
  onApply: (value: {latitude: string; longitude: string; radiusMetres: string}) => void;
}) {
  const [form, setForm] = useState(initial);

  return (
    <Modal
      title="Search by location"
      description="Finds listings within a radius of a point — a PostGIS query, not a client-side filter."
      onClose={onClose}
    >
      <form
        className={fieldStyles.modalBody}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onApply(form);
        }}
      >
        <Field label="Latitude" htmlFor="geo-lat">
          <TextInput
            id="geo-lat"
            placeholder="-6.7460"
            value={form.latitude}
            onChange={(event) => setForm({...form, latitude: event.target.value})}
            required
          />
        </Field>
        <Field label="Longitude" htmlFor="geo-lng">
          <TextInput
            id="geo-lng"
            placeholder="39.2803"
            value={form.longitude}
            onChange={(event) => setForm({...form, longitude: event.target.value})}
            required
          />
        </Field>
        <Field label="Radius (metres)" htmlFor="geo-radius">
          <TextInput
            id="geo-radius"
            type="number"
            value={form.radiusMetres}
            onChange={(event) => setForm({...form, radiusMetres: event.target.value})}
            required
          />
        </Field>
        <div className={fieldStyles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Apply</Button>
        </div>
      </form>
    </Modal>
  );
}

function ModerationDialog({
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

  async function confirm(reason: string) {
    setBusy(true);
    setError(null);
    try {
      await api.changePropertyStatus(decision.property.id, {
        status: decision.action.status,
        reason: reason || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this listing');
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      title={`${decision.action.label}: ${decision.property.title}`}
      description={`${decision.property.reference_code} — currently ${humanise(decision.property.status)}.`}
      confirmLabel={decision.action.label}
      destructive={decision.action.destructive}
      reasonLabel={decision.action.reason}
      reasonRequired={Boolean(decision.action.reason)}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
