import {useState} from 'react';
import type {FormEvent} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import type {Inquiry} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {useListFilters} from '../../hooks/useListFilters';
import {
  Button, Card, DataTable, DetailGrid, Field, FilterBar, Modal, PageSection,
  Pagination, RowActions, Select, StatusBadge, TextArea, humanise, fieldStyles,
} from '../../components/ui';
import {useAdminSearch} from './searchContext';
import {useAttention} from './attentionContext';

const STATUSES = [
  {value: 'pending', label: 'Awaiting reply'},
  {value: 'responded', label: 'Replied'},
  {value: 'accepted', label: 'Accepted'},
  {value: 'rejected', label: 'Declined'},
  {value: 'withdrawn', label: 'Withdrawn'},
  {value: 'closed', label: 'Closed'},
];

/**
 * What customers have asked about properties, and the reply that goes back to
 * their phone.
 *
 * A pending enquiry is somebody waiting, so the oldest are shown first and the
 * count is on the sidebar — this is the screen that decides whether the app
 * feels answered or ignored.
 */
export function InquiriesPage() {
  const api = useAdminApi();
  const attention = useAttention();
  const {filters, setFilter, offset, setOffset, key, limit} = useListFilters({status: ''});
  const searchTerm = useAdminSearch('Reference, property, customer or message');
  const [replying, setReplying] = useState<Inquiry | null>(null);

  const {state, refresh} = useResource(
    () => api.listInquiries({...filters, query: searchTerm || undefined, limit, offset}),
    `inquiries-${searchTerm}-${key}`
  );

  return (
    <PageSection
      title="Enquiries"
      description="Questions customers have asked about properties, and what was said back."
    >
      <Card>
        <FilterBar>
          <Field label="Status" htmlFor="inquiry-status">
            <Select
              id="inquiry-status"
              placeholder="All statuses"
              options={STATUSES}
              value={filters.status}
              onChange={(event) => setFilter('status', event.target.value)}
            />
          </Field>
        </FilterBar>
      </Card>

      <Card>
        <DataTable<Inquiry>
          status={state.status}
          error={state.status === 'error' ? state.error : undefined}
          onRetry={refresh}
          rows={state.data?.items ?? []}
          emptyMessage="No enquiries match these filters."
          columns={[
            {key: 'reference', header: 'Reference', render: (i) => <code>{i.reference}</code>},
            {key: 'property', header: 'Property', render: (i) => i.property_title},
            {
              key: 'customer',
              header: 'From',
              render: (i) => (
                <span className={fieldStyles.inlineStack}>
                  <span>{i.customer_name ?? '—'}</span>
                  <span>{i.customer_phone ?? ''}</span>
                </span>
              ),
            },
            {
              key: 'message',
              header: 'Asked',
              render: (i) => (
                <span title={i.message}>
                  {i.message.length > 60 ? `${i.message.slice(0, 60)}…` : i.message}
                </span>
              ),
            },
            {key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} />},
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (inquiry) => (
                <RowActions>
                  <Button variant="ghost" size="small" onClick={() => setReplying(inquiry)}>
                    {inquiry.status === 'pending' ? 'Reply' : 'View'}
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

      {replying && (
        <ReplyModal
          inquiry={replying}
          onClose={() => setReplying(null)}
          onSaved={() => {
            setReplying(null);
            refresh();
            // The sidebar count and this list must move together.
            attention.refresh();
          }}
        />
      )}
    </PageSection>
  );
}

/**
 * Replying, accepting or declining. A decline needs a reason because the
 * customer is shown it — "declined" with nothing after it is the worst message
 * the app can deliver.
 */
function ReplyModal({
  inquiry,
  onClose,
  onSaved,
}: {
  inquiry: Inquiry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useAdminApi();
  const [status, setStatus] = useState(inquiry.status === 'pending' ? 'responded' : inquiry.status);
  const [response, setResponse] = useState(inquiry.response ?? '');
  const [rejectionReason, setRejectionReason] = useState(inquiry.rejection_reason ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDecline = status === 'rejected';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.respondToInquiry(inquiry.id, {status, response, rejectionReason});
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that reply');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Enquiry ${inquiry.reference}`}
      description={`${inquiry.customer_name ?? 'A customer'} about ${inquiry.property_title}`}
      onClose={onClose}
    >
      <DetailGrid
        items={[
          {label: 'Status', value: <StatusBadge status={inquiry.status} />},
          {label: 'Customer', value: inquiry.customer_name ?? '—'},
          {label: 'Phone', value: inquiry.customer_phone ?? '—'},
          {label: 'Property', value: `${inquiry.property_reference} · ${inquiry.property_title}`},
          {label: 'Wants to move in', value: inquiry.move_in_date ?? '—'},
          {label: 'Budget', value: inquiry.budget_amount ? `TZS ${Number(inquiry.budget_amount).toLocaleString()}` : '—'},
          {label: 'Occupants', value: inquiry.occupants ?? '—'},
          {
            label: 'Prefers',
            value: inquiry.contact_preference ? humanise(inquiry.contact_preference) : '—',
          },
          {label: 'Asked', value: new Date(inquiry.created_at).toLocaleString()},
        ]}
      />

      <div className={fieldStyles.quoteBlock}>
        <p>{inquiry.message}</p>
      </div>

      <form onSubmit={handleSubmit} className={fieldStyles.modalBody}>
        {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}

        <Field label="What happens next" htmlFor="inquiry-outcome">
          <Select
            id="inquiry-outcome"
            options={[
              {value: 'responded', label: 'Reply to the customer'},
              {value: 'accepted', label: 'Accept — invite them to book'},
              {value: 'rejected', label: 'Decline'},
              {value: 'closed', label: 'Close without a reply'},
            ]}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          />
        </Field>

        {isDecline ? (
          <Field label="Why are you declining?" htmlFor="inquiry-reason">
            <TextArea
              id="inquiry-reason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="It has just been taken — we will let you know if it frees up."
            />
          </Field>
        ) : (
          <Field label="Your reply" htmlFor="inquiry-response">
            <TextArea
              id="inquiry-response"
              rows={4}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder="Yes, it is available from 1 November. Would you like to see it?"
            />
          </Field>
        )}

        <p className={fieldStyles.hint}>
          This is sent to the customer&rsquo;s app and shown in their enquiry.
        </p>

        <div className={fieldStyles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Close</Button>
          <Button type="submit" variant={isDecline ? 'danger' : 'primary'} disabled={busy}>
            {busy ? 'Sending…' : isDecline ? 'Decline enquiry' : 'Send reply'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
