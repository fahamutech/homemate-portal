import {useState} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import type {Booking, BookingDetail} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {useListFilters} from '../../hooks/useListFilters';
import {
  Button, Card, ConfirmDialog, DataTable, DetailGrid, Field, FilterBar, Modal,
  PageSection, Pagination, RowActions, Select, StatusBadge, humanise, fieldStyles,
} from '../../components/ui';
import {useAdminSearch} from './searchContext';
import {useAttention} from './attentionContext';

const STATUSES = [
  {value: 'pending', label: 'Pending'},
  {value: 'awaiting_payment', label: 'Awaiting payment'},
  {value: 'confirmed', label: 'Confirmed'},
  {value: 'active', label: 'Active rental'},
  {value: 'completed', label: 'Completed'},
  {value: 'cancelled', label: 'Cancelled'},
  {value: 'expired', label: 'Expired'},
];

const NEXT: Record<string, {status: string; label: string; reason?: string; destructive?: boolean}[]> = {
  pending: [
    {status: 'awaiting_payment', label: 'Request payment'},
    {status: 'cancelled', label: 'Cancel', reason: 'Why is it cancelled?', destructive: true},
  ],
  awaiting_payment: [
    {status: 'confirmed', label: 'Confirm'},
    {status: 'cancelled', label: 'Cancel', reason: 'Why is it cancelled?', destructive: true},
  ],
  confirmed: [
    {status: 'active', label: 'Start tenancy'},
    {status: 'cancelled', label: 'Cancel', reason: 'Why is it cancelled?', destructive: true},
  ],
  active: [{status: 'completed', label: 'End tenancy'}],
  completed: [],
  cancelled: [],
  expired: [{status: 'pending', label: 'Reopen'}],
};

function money(value: string | number | null | undefined, currency = 'TZS') {
  return `${currency} ${Number(value ?? 0).toLocaleString(undefined, {maximumFractionDigits: 0})}`;
}

/**
 * Bookings and active rentals.
 *
 * Confirming is what takes a property off the market, and the database refuses
 * it until the money has actually settled — so a confirm that fails here is
 * the system working, and the refusal is shown as written.
 */
export function BookingsPage() {
  const api = useAdminApi();
  const attention = useAttention();
  const {filters, setFilter, offset, setOffset, key, limit} = useListFilters({status: ''});
  const searchTerm = useAdminSearch('Reference, property or customer');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [decision, setDecision] = useState<
    {booking: Booking; move: {status: string; label: string; reason?: string; destructive?: boolean}} | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const {state, refresh} = useResource(
    () => api.listBookings({...filters, query: searchTerm || undefined, limit, offset}),
    `bookings-${searchTerm}-${key}`
  );

  return (
    <PageSection
      title="Bookings & rentals"
      description="What customers have booked, what they owe, and which tenancies are running."
    >
      {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}

      <Card>
        <FilterBar>
          <Field label="Status" htmlFor="booking-status">
            <Select
              id="booking-status"
              placeholder="All statuses"
              options={STATUSES}
              value={filters.status}
              onChange={(event) => setFilter('status', event.target.value)}
            />
          </Field>
        </FilterBar>
      </Card>

      <Card>
        <DataTable<Booking>
          status={state.status}
          error={state.status === 'error' ? state.error : undefined}
          onRetry={refresh}
          rows={state.data?.items ?? []}
          emptyMessage="No bookings match these filters."
          columns={[
            {key: 'reference', header: 'Reference', render: (b) => <code>{b.reference}</code>},
            {key: 'property', header: 'Property', render: (b) => b.property_title},
            {
              key: 'customer',
              header: 'Customer',
              render: (b) => (
                <span className={fieldStyles.inlineStack}>
                  <span>{b.customer_name ?? '—'}</span>
                  <span>{b.customer_phone ?? ''}</span>
                </span>
              ),
            },
            {key: 'due', header: 'Total due', render: (b) => money(b.total_due, b.currency)},
            {
              key: 'outstanding',
              header: 'Outstanding',
              render: (b) => (
                <span className={fieldStyles.inlineStack}>
                  <span>{money(b.amount_outstanding, b.currency)}</span>
                  {Number(b.amount_awaiting_verification) > 0 && <span>being checked</span>}
                </span>
              ),
            },
            {key: 'status', header: 'Status', render: (b) => <StatusBadge status={b.status} />},
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (booking) => (
                <RowActions>
                  <Button variant="ghost" size="small" onClick={() => setDetailId(booking.id)}>
                    View
                  </Button>
                  {(NEXT[booking.status] ?? []).map((move) => (
                    <Button
                      key={move.status}
                      variant={move.destructive ? 'ghost' : 'outline'}
                      size="small"
                      onClick={() => setDecision({booking, move})}
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
          title={`${decision.move.label} ${decision.booking.reference}?`}
          description={
            decision.move.status === 'confirmed'
              ? 'This takes the property off the market. It is refused until the money has been verified.'
              : 'The customer is notified.'
          }
          confirmLabel={decision.move.label}
          destructive={decision.move.destructive}
          reasonLabel={decision.move.reason}
          error={error}
          onCancel={() => {
            setDecision(null);
            setError(null);
          }}
          onConfirm={async (reason) => {
            try {
              await api.changeBookingStatus(decision.booking.id, {
                status: decision.move.status,
                reason,
              });
              setDecision(null);
              setError(null);
              refresh();
              attention.refresh();
            } catch (err) {
              // The database's own explanation — "this booking has 0 of
              // 2,400,000 settled" — is better than anything invented here.
              setError(err instanceof Error ? err.message : 'That change was refused');
            }
          }}
        />
      )}

      {detailId && <BookingDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </PageSection>
  );
}

function BookingDetailModal({id, onClose}: {id: string; onClose: () => void}) {
  const api = useAdminApi();
  const {state} = useResource<BookingDetail>(() => api.getBooking(id), `booking-${id}`);
  const booking = state.data;

  return (
    <Modal
      title={booking ? `Booking ${booking.reference}` : 'Booking'}
      description={booking?.property_title}
      onClose={onClose}
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      {state.status === 'error' && (
        <div className={fieldStyles.errorBlock} role="alert">{state.error}</div>
      )}
      {booking && (
        <>
          <DetailGrid
            items={[
              {label: 'Status', value: <StatusBadge status={booking.status} />},
              {label: 'Customer', value: `${booking.customer_name ?? '—'} · ${booking.customer_phone ?? ''}`},
              {label: 'Landlord', value: booking.landlord_name ?? '—'},
              {label: 'Monthly rent', value: money(booking.monthly_rent, booking.currency)},
              {label: 'Deposit', value: money(booking.deposit_amount, booking.currency)},
              {label: 'Total due', value: money(booking.total_due, booking.currency)},
              {label: 'Paid', value: money(booking.amount_paid, booking.currency)},
              {label: 'Outstanding', value: money(booking.amount_outstanding, booking.currency)},
              {
                label: 'Awaiting verification',
                value: money(booking.amount_awaiting_verification, booking.currency),
              },
              {label: 'Lease', value: booking.lease_months ? `${booking.lease_months} months` : '—'},
              {label: 'Move in', value: booking.move_in_date ?? '—'},
              {label: 'Cancelled because', value: booking.cancellation_reason ?? '—'},
            ]}
          />

          {booking.payments.length > 0 && (
            <>
              <p className={fieldStyles.sectionTitle}>Payments</p>
              {booking.payments.map((payment) => (
                <div key={payment.id} className={fieldStyles.listRow}>
                  <span>
                    <code>{payment.reference}</code> · {humanise(payment.purpose)}
                  </span>
                  <span className={fieldStyles.inlineStack}>
                    <span>{money(payment.amount, payment.currency)}</span>
                    <StatusBadge status={payment.customer_state} />
                  </span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
