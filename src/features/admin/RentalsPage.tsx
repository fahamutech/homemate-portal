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
  {value: 'awaiting_payment', label: 'Paying — not yet verified'},
  {value: 'confirmed', label: 'Paid — tenancy not started'},
  {value: 'active', label: 'Tenancy running'},
  {value: 'completed', label: 'Tenancy ended'},
  {value: 'expired', label: 'Lapsed unpaid'},
];

/**
 * The only moves a person makes here. There is no booking workflow: a
 * customer's enquiry is accepted, they pay, and verifying the payment confirms
 * the home by itself. What is left is the tenancy — starting it and ending it.
 */
const NEXT: Record<string, {status: string; label: string}[]> = {
  confirmed: [{status: 'active', label: 'Start tenancy'}],
  active: [{status: 'completed', label: 'End tenancy'}],
};

function money(value: string | number | null | undefined, currency = 'TZS') {
  return `${currency} ${Number(value ?? 0).toLocaleString(undefined, {maximumFractionDigits: 0})}`;
}

/**
 * Homes customers have paid for, and the tenancies running in them.
 *
 * A row appears here the moment a customer whose enquiry was accepted starts
 * paying, and becomes a tenancy when Payments verifies the money — nobody
 * confirms anything by hand on this screen.
 */
export function RentalsPage() {
  const api = useAdminApi();
  const attention = useAttention();
  const {filters, setFilter, offset, setOffset, key, limit} = useListFilters({status: ''});
  const searchTerm = useAdminSearch('Reference, property or customer');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [decision, setDecision] = useState<
    {booking: Booking; move: {status: string; label: string}} | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const {state, refresh} = useResource(
    () => api.listBookings({...filters, query: searchTerm || undefined, limit, offset}),
    `bookings-${searchTerm}-${key}`
  );

  return (
    <PageSection
      title="Rentals"
      description="Homes customers have paid for, what is still being verified, and which tenancies are running."
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
          emptyMessage="No rentals match these filters."
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
            {key: 'rent', header: 'Monthly rent', render: (b) => money(b.monthly_rent, b.currency)},
            {key: 'due', header: 'First payment', render: (b) => money(b.total_due, b.currency)},
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
                      variant="outline"
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
          description="The customer is notified."
          confirmLabel={decision.move.label}
          error={error}
          onCancel={() => {
            setDecision(null);
            setError(null);
          }}
          onConfirm={async () => {
            try {
              await api.changeBookingStatus(decision.booking.id, {status: decision.move.status});
              setDecision(null);
              setError(null);
              refresh();
              attention.refresh();
            } catch (err) {
              // The server's own explanation is better than anything invented here.
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
      title={booking ? `Rental ${booking.reference}` : 'Rental'}
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
              {
                label: 'HomeMate fee',
                value: Number(booking.service_fee ?? 0) > 0
                  ? `${money(booking.service_fee, booking.currency)} (${Number(booking.service_fee_percentage)}% of a month) · HomeMate keeps ${money(booking.platform_fee, booking.currency)}`
                  : '—',
              },
              {label: 'First payment', value: money(booking.total_due, booking.currency)},
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

          {(booking.history?.length ?? 0) > 0 && (
            <>
              <p className={fieldStyles.sectionTitle} id={`booking-history-${booking.id}`}>History</p>
              <ul aria-labelledby={`booking-history-${booking.id}`} className={fieldStyles.plainList}>
                {booking.history!.map((entry) => (
                  <li key={`${entry.status}-${entry.at}`} className={fieldStyles.listRow}>
                    <span>{entry.label}</span>
                    <span>
                      {new Date(entry.at).toLocaleString()}
                      {!entry.by_landlord && entry.actor ? ` · ${entry.actor}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
