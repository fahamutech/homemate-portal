import {useState} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import {CONFIRMATION_LABEL, listedBySentence} from './partners/labels';
import type {AdminPropertyDetail} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {AuthedImage} from './AuthedImage';
import {
  Button, DetailGrid, Modal, StatusBadge, humanise, fieldStyles,
} from '../../components/ui';
import styles from './PropertyDetailModal.module.css';

const TABS = ['Overview', 'Terms & money', 'People', 'Photos', 'Amenities'] as const;
type Tab = (typeof TABS)[number];

function money(amount: string | number | null | undefined, currency = 'TZS') {
  if (amount === null || amount === undefined || amount === '') return '—';
  return `${currency} ${Number(amount).toLocaleString()}`;
}

const FREQUENCY_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-annual',
  annual: 'Annual',
  custom: 'Custom',
  one_time: 'One-time',
  per_use: 'Per use',
};

/**
 * Everything known about a property, on tabs so the moderator can answer
 * "is this publishable?" without leaving the screen: what it is, what it
 * costs in total, who is attributed to it, what it looks like, and what it
 * offers.
 */
export function PropertyDetailModal({id, onClose}: {id: string; onClose: () => void}) {
  const api = useAdminApi();
  const [tab, setTab] = useState<Tab>('Overview');
  const {state} = useResource(() => api.getProperty(id), id);
  const property = state.data as AdminPropertyDetail | null;

  return (
    <Modal
      title={property?.title ?? 'Property'}
      description={property ? `${property.reference_code} · ${humanise(property.status)}` : undefined}
      onClose={onClose}
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      {state.status === 'loading' && !property && <p className={fieldStyles.stateBlock}>Loading…</p>}
      {state.status === 'error' && (
        <div className={fieldStyles.errorBlock} role="alert">{state.error}</div>
      )}

      {property && (
        <>
          <nav className={styles.tabs} aria-label="Property sections">
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                className={`${styles.tab} ${tab === name ? styles.tabActive : ''}`}
                onClick={() => setTab(name)}
              >
                {name}
                {name === 'Photos' && property.media.length > 0 ? ` (${property.media.length})` : ''}
                {name === 'Amenities' && property.amenities.length > 0 ? ` (${property.amenities.length})` : ''}
              </button>
            ))}
          </nav>

          {tab === 'Overview' && (
            <>
              {property.rejection_reason && (
                <div className={fieldStyles.errorBlock}>Review note: {property.rejection_reason}</div>
              )}
              <DetailGrid
                items={[
                  {label: 'Status', value: <StatusBadge status={property.status} />},
                  {label: 'Listing', value: humanise(property.listing_type)},
                  {label: 'Type', value: property.property_type_name ?? '—'},
                  {label: 'Furnishing', value: humanise(property.furnishing ?? null)},
                  {label: 'Bedrooms', value: property.bedrooms ?? '—'},
                  {label: 'Bathrooms', value: property.bathrooms ?? '—'},
                  {label: 'Size', value: property.size_sqm ? `${property.size_sqm} sqm` : '—'},
                  {label: 'Parking', value: property.parking_spaces ?? '—'},
                  {label: 'Floor', value: property.floor_number ?? '—'},
                  {label: 'Year built', value: property.year_built ?? '—'},
                  {label: 'Max occupants', value: property.max_occupants ?? '—'},
                  {label: 'Pets', value: property.pets_allowed ? 'Allowed' : 'Not allowed'},
                  {label: 'Smoking', value: property.smoking_allowed ? 'Allowed' : 'Not allowed'},
                  {label: 'Address', value: property.address_line ?? '—'},
                  {label: 'Ward', value: property.ward_name ?? '—'},
                  {label: 'District', value: property.district_name ?? '—'},
                  {label: 'Region', value: property.region_name ?? '—'},
                  {
                    label: 'Coordinates',
                    value: property.latitude ? `${property.latitude}, ${property.longitude}` : 'Not pinned',
                  },
                  {label: 'Available from', value: property.available_from ?? '—'},
                ]}
              />
              {property.description && <p className={styles.prose}>{property.description}</p>}
            </>
          )}

          {tab === 'Terms & money' && (
            <>
              <DetailGrid
                items={[
                  {label: 'Rent / price', value: money(property.price, property.currency)},
                  {label: 'Payment mode', value: <span data-testid="payment-mode">{FREQUENCY_LABEL[property.payment_frequency ?? ''] ?? '—'}</span>},
                  {label: 'Months per payment', value: property.payment_months ?? '—'},
                  {label: 'Amount per instalment', value: money(property.amount_per_instalment, property.currency)},
                  {label: 'Deposit', value: `${property.deposit_months ?? 0} months · ${money(property.deposit_amount, property.currency)}`},
                  {label: 'Advance rent', value: `${property.advance_rent_months ?? 0} months`},
                  {label: 'Lease', value: `${property.min_lease_months ?? 1}–${property.max_lease_months ?? '∞'} months`},
                  {label: 'Notice period', value: `${property.notice_period_days ?? 0} days`},
                  {label: 'Total monthly cost', value: money(property.total_monthly_cost, property.currency)},
                  {label: 'One-time charges', value: money(property.one_time_charges_total, property.currency)},
                ]}
              />

              <h4 className={styles.sectionTitle}>Charges besides rent</h4>
              {property.charges.length === 0 ? (
                <p className={fieldStyles.stateBlock}>No additional charges recorded.</p>
              ) : (
                <table className={fieldStyles.table}>
                  <thead>
                    <tr><th>Charge</th><th>Amount</th><th>Frequency</th><th>Mandatory</th><th>Refundable</th></tr>
                  </thead>
                  <tbody>
                    {property.charges.map((charge) => (
                      <tr key={charge.id}>
                        <td data-label="Charge">{charge.name}</td>
                        <td data-label="Amount">{money(charge.amount, charge.currency)}</td>
                        <td data-label="Frequency">{FREQUENCY_LABEL[charge.frequency] ?? charge.frequency}</td>
                        <td data-label="Mandatory">{charge.is_mandatory ? 'Yes' : 'Optional'}</td>
                        <td data-label="Refundable">{charge.is_refundable ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <h4 className={styles.sectionTitle}>Accepted payment methods</h4>
              {property.paymentMethods.length === 0 ? (
                <p className={fieldStyles.stateBlock}>All active platform methods are accepted.</p>
              ) : (
                <ul className={styles.chips}>
                  {property.paymentMethods.map((method) => (
                    <li key={method.id}>{method.name}</li>
                  ))}
                </ul>
              )}

              {property.terms && (
                <>
                  <h4 className={styles.sectionTitle}>Tenancy terms</h4>
                  <p className={styles.prose}>{property.terms}</p>
                </>
              )}
              {property.house_rules && (
                <>
                  <h4 className={styles.sectionTitle}>House rules</h4>
                  <p className={styles.prose}>{property.house_rules}</p>
                </>
              )}
            </>
          )}

          {tab === 'People' && (
            <>
              <p className={fieldStyles.hint}>
                {listedBySentence(property.listed_by)}
                {property.landlord_confirmation && property.landlord_confirmation.status !== 'not_required' && (
                  <>
                    {' · '}
                    {property.landlord_confirmation.status === 'disputed'
                      ? `Landlord disputed: ${property.landlord_confirmation.reason ?? 'no reason given'}`
                      : `Landlord confirmation: ${CONFIRMATION_LABEL[property.landlord_confirmation.status]}`}
                  </>
                )}
              </p>
              {property.parties.length === 0 ? (
                <p className={fieldStyles.stateBlock}>Nobody is attributed to this property yet.</p>
              ) : (
                <table className={fieldStyles.table}>
                  <thead>
                    <tr><th>Role</th><th>Name</th><th>Contact</th><th>Commission</th><th>Assigned by</th></tr>
                  </thead>
                  <tbody>
                    {property.parties.map((party) => (
                      <tr key={party.id}>
                        <td data-label="Role">{humanise(party.role)}{party.is_primary ? ' · primary' : ''}</td>
                        <td data-label="Name">
                          {party.full_name ?? '—'}
                          {party.role === 'landlord' && party.confirmation_status && party.confirmation_status !== 'not_required' && (
                            <> <StatusBadge status={party.confirmation_status} label={CONFIRMATION_LABEL[party.confirmation_status]} /></>
                          )}
                        </td>
                        <td data-label="Contact">{party.phone_number ?? party.email ?? '—'}</td>
                        <td data-label="Commission">
                          {party.commission_percentage ? `${party.commission_percentage}%` : '—'}
                        </td>
                        <td data-label="Assigned by">{party.assigned_by ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <DetailGrid
                items={[
                  {label: 'Owner of record', value: property.owner_name ?? '—'},
                  {label: 'Agency', value: property.organization_name ?? '—'},
                  {label: 'Reviewed by', value: property.reviewed_by ?? 'Not yet reviewed'},
                ]}
              />
            </>
          )}

          {tab === 'Photos' && (
            property.media.length === 0 ? (
              <p className={fieldStyles.stateBlock}>No photos uploaded yet.</p>
            ) : (
              <ul className={styles.gallery}>
                {property.media.map((image) => (
                  <li key={image.id}>
                    <AuthedImage source={{kind: 'media', id: image.id}} thumbnail alt={image.caption ?? property.title} className={styles.photo} />
                    <span>
                      {image.is_cover ? 'Cover' : ''}
                      {image.caption ? ` · ${image.caption}` : ''}
                      {image.width ? ` · ${image.width}×${image.height}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === 'Amenities' && (
            property.amenities.length === 0 ? (
              <p className={fieldStyles.stateBlock}>No amenities recorded.</p>
            ) : (
              <ul className={styles.chips}>
                {property.amenities.map((amenity) => (
                  <li key={amenity.id}>{amenity.name}</li>
                ))}
              </ul>
            )
          )}
        </>
      )}
    </Modal>
  );
}
