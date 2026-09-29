import {useEffect, useMemo, useRef, useState} from 'react';
import type {FormEvent} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import type {AdminProperty, AdminPropertyDetail} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {prepareImages} from './imagePipeline';
import type {PreparedImage} from './imagePipeline';
import {LocationPicker} from './LocationPicker';
import type {PickedLocation} from './LocationPicker';
import {
  Button, Field, Modal, Select, TextArea, TextInput, fieldStyles,
} from '../../components/ui';
import styles from './PropertyFormModal.module.css';

const LISTING_TYPES = [
  {value: 'rent', label: 'For rent'},
  {value: 'sale', label: 'For sale'},
];

const FURNISHING = [
  {value: 'unfurnished', label: 'Unfurnished'},
  {value: 'semi_furnished', label: 'Semi furnished'},
  {value: 'fully_furnished', label: 'Fully furnished'},
];

const PAYMENT_FREQUENCIES = [
  {value: 'monthly', label: 'Monthly'},
  {value: 'quarterly', label: 'Quarterly (3 months)'},
  {value: 'semi_annual', label: 'Semi-annual (6 months)'},
  {value: 'annual', label: 'Annual (12 months)'},
  {value: 'custom', label: 'Custom number of months'},
];

const CHARGE_FREQUENCIES = [
  {value: 'monthly', label: 'Monthly'},
  {value: 'quarterly', label: 'Quarterly'},
  {value: 'semi_annual', label: 'Semi-annual'},
  {value: 'annual', label: 'Annual'},
  {value: 'one_time', label: 'One-time'},
  {value: 'per_use', label: 'Per use'},
];

const STEPS = ['Basics', 'Location', 'Terms & pricing', 'Amenities & charges', 'People', 'Photos'] as const;
type Step = (typeof STEPS)[number];

interface DraftCharge {
  name: string;
  amount: string;
  frequency: string;
  isMandatory: boolean;
  isRefundable: boolean;
}

interface DraftParty {
  userId: string;
  role: 'landlord' | 'broker' | 'agency';
  commissionPercentage: string;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  listingType: 'rent',
  propertyTypeId: '',
  regionId: '',
  districtId: '',
  wardId: '',
  addressLine: '',
  price: '',
  currency: 'TZS',
  bedrooms: '',
  bathrooms: '',
  sizeSqm: '',
  furnishing: 'unfurnished',
  floorNumber: '',
  totalFloors: '',
  yearBuilt: '',
  parkingSpaces: '0',
  maxOccupants: '',
  petsAllowed: false,
  smokingAllowed: false,
  availableFrom: '',
  minLeaseMonths: '1',
  maxLeaseMonths: '',
  paymentFrequency: 'monthly',
  customPaymentMonths: '',
  depositMonths: '0',
  advanceRentMonths: '0',
  noticePeriodDays: '30',
  terms: '',
  houseRules: '',
};

/** Turns a loaded property back into the form's own string-shaped state. */
function formFrom(property: AdminPropertyDetail): typeof EMPTY_FORM {
  const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
  return {
    ...EMPTY_FORM,
    title: text(property.title),
    description: text(property.description),
    listingType: property.listing_type ?? 'rent',
    propertyTypeId: text(property.property_type_id),
    regionId: text(property.region_id),
    districtId: text(property.district_id),
    wardId: text(property.ward_id),
    addressLine: text(property.address_line),
    price: text(property.price),
    currency: property.currency ?? 'TZS',
    bedrooms: text(property.bedrooms),
    bathrooms: text(property.bathrooms),
    sizeSqm: text(property.size_sqm),
    furnishing: property.furnishing ?? 'unfurnished',
    floorNumber: text(property.floor_number),
    totalFloors: text(property.total_floors),
    yearBuilt: text(property.year_built),
    parkingSpaces: text(property.parking_spaces ?? 0),
    maxOccupants: text(property.max_occupants),
    petsAllowed: Boolean(property.pets_allowed),
    smokingAllowed: Boolean(property.smoking_allowed),
    availableFrom: text(property.available_from).slice(0, 10),
    minLeaseMonths: text(property.min_lease_months ?? 1),
    maxLeaseMonths: text(property.max_lease_months),
    paymentFrequency: property.payment_frequency ?? 'monthly',
    customPaymentMonths: text(property.custom_payment_months),
    depositMonths: text(property.deposit_months ?? 0),
    advanceRentMonths: text(property.advance_rent_months ?? 0),
    noticePeriodDays: text(property.notice_period_days ?? 30),
    terms: text(property.terms),
    houseRules: text(property.house_rules),
  };
}

const LANDLORD_PICKER_STATUSES = 'invited,applied,pending_review,action_needed,active,suspended';

/**
 * One multi-step form for both capturing a new property and correcting an
 * existing one: the fields, the validation and the map picker are identical,
 * and a second nearly-identical component is how the two drift apart.
 *
 * The difference is what a save means. Creating writes the property and then
 * its amenities, charges, parties and photos in one submit, so a
 * half-captured listing never exists. Editing works on records that are
 * already there — removing a charge or a photo takes effect at once, because
 * pretending otherwise would show a listing that does not match the registry.
 */
export function PropertyFormModal({
  propertyId,
  onClose,
  onSaved,
}: {
  propertyId?: string;
  onClose: () => void;
  onSaved: (property: AdminProperty) => void;
}) {
  const api = useAdminApi();
  const isEditing = Boolean(propertyId);
  const [step, setStep] = useState<Step>('Basics');
  const [form, setForm] = useState(EMPTY_FORM);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [amenityIds, setAmenityIds] = useState<string[]>([]);
  const [charges, setCharges] = useState<DraftCharge[]>([]);
  const [parties, setParties] = useState<DraftParty[]>([]);
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [paymentMethodIds, setPaymentMethodIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const existing = useResource(
    () => (propertyId ? api.getProperty(propertyId) : Promise.resolve(null)),
    `property-form-${propertyId ?? 'new'}`
  );
  const loaded = existing.state.data;
  const seeded = useRef(false);

  // Seed once: re-seeding on every refresh would throw away edits in progress.
  useEffect(() => {
    if (!loaded || seeded.current) return;
    seeded.current = true;
    setForm(formFrom(loaded));
    setAmenityIds(loaded.amenities.map((amenity) => amenity.id));
    setPaymentMethodIds(loaded.paymentMethods.map((method) => method.id));
    if (loaded.latitude !== null && loaded.longitude !== null) {
      setLocation({
        latitude: Number(loaded.latitude),
        longitude: Number(loaded.longitude),
        addressLine: loaded.address_line ?? '',
      });
    }
  }, [loaded]);

  const propertyTypes = useResource(() => api.listDictionary('property_type'), 'property_type');
  const regions = useResource(() => api.listDictionary('region'), 'region');
  const districts = useResource(
    () => (form.regionId ? api.listDictionary('district', {parentId: form.regionId}) : Promise.resolve({items: []})),
    `district-${form.regionId}`
  );
  const wards = useResource(
    () => (form.districtId ? api.listDictionary('ward', {parentId: form.districtId}) : Promise.resolve({items: []})),
    `ward-${form.districtId}`
  );
  const amenityCatalogue = useResource(() => api.listDictionary('amenity'), 'amenity');
  const methods = useResource(() => api.listPaymentMethods({activeOnly: true}), 'active-payment-methods');
  // By T01 role, not users.role: a broker must be an approved broker; a landlord
  // may be anyone holding a landlord role that was not rejected (T04 lets a
  // broker list for an invited landlord).
  const landlords = useResource(
    () => api.listUsers({partnerRole: 'landlord', partnerStatus: LANDLORD_PICKER_STATUSES, limit: 100}),
    'landlords'
  );
  const brokers = useResource(
    () => api.listUsers({partnerRole: 'broker', partnerStatus: 'active', limit: 100}),
    'brokers'
  );
  const agencies = useResource(() => api.listUsers({role: 'agency', limit: 100}), 'agency-users');

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((current) => ({...current, [key]: value}));
  }

  const estimatedMonthly = useMemo(() => {
    const rent = Number(form.price) || 0;
    const recurring = charges
      .filter((c) => c.isMandatory)
      .reduce((total, charge) => {
        const amount = Number(charge.amount) || 0;
        const perMonth =
          charge.frequency === 'monthly' ? amount
          : charge.frequency === 'quarterly' ? amount / 3
          : charge.frequency === 'semi_annual' ? amount / 6
          : charge.frequency === 'annual' ? amount / 12
          : 0;
        return total + perMonth;
      }, 0);
    return rent + recurring;
  }, [form.price, charges]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError(null);
    setProgress('Converting images to WebP…');
    const {prepared, errors} = await prepareImages([...fileList]);
    setImages((current) => [...current, ...prepared]);
    setProgress(null);
    if (errors.length) setError(errors.join(' '));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) {
      setStep('Basics');
      setError('A title is required');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      setProgress('Saving the listing…');
      const fields = {
        ...form,
        price: form.price || undefined,
        bedrooms: form.bedrooms || undefined,
        bathrooms: form.bathrooms || undefined,
        sizeSqm: form.sizeSqm || undefined,
        floorNumber: form.floorNumber || undefined,
        totalFloors: form.totalFloors || undefined,
        yearBuilt: form.yearBuilt || undefined,
        maxOccupants: form.maxOccupants || undefined,
        maxLeaseMonths: form.maxLeaseMonths || undefined,
        customPaymentMonths: form.customPaymentMonths || undefined,
        availableFrom: form.availableFrom || undefined,
        propertyTypeId: form.propertyTypeId || undefined,
        regionId: form.regionId || undefined,
        districtId: form.districtId || undefined,
        wardId: form.wardId || undefined,
        addressLine: location?.addressLine ?? (form.addressLine || undefined),
        latitude: location?.latitude,
        longitude: location?.longitude,
      };
      const property = propertyId
        ? await api.updateProperty(propertyId, fields)
        : await api.createProperty(fields);

      // Sent unconditionally: these are set-the-whole-list operations, so
      // clearing the last amenity has to reach the server too.
      if (isEditing || amenityIds.length) {
        setProgress('Saving amenities…');
        await api.setPropertyAmenities(property.id, amenityIds);
      }

      for (const charge of charges) {
        setProgress(`Saving charge: ${charge.name}…`);
        await api.addPropertyCharge(property.id, {
          name: charge.name,
          amount: charge.amount,
          frequency: charge.frequency,
          isMandatory: charge.isMandatory,
          isRefundable: charge.isRefundable,
        });
      }

      for (const party of parties.filter((p) => p.userId)) {
        setProgress('Saving attribution…');
        await api.assignPropertyParty(property.id, {
          userId: party.userId,
          role: party.role,
          commissionPercentage: party.commissionPercentage || undefined,
          isPrimary: true,
        });
      }

      for (const [index, image] of images.entries()) {
        setProgress(`Uploading photo ${index + 1} of ${images.length}…`);
        await api.uploadPropertyImage(property.id, {
          image: image.image,
          thumbnail: image.thumbnail,
          width: image.image.width,
          height: image.image.height,
          isCover: index === 0,
        });
      }

      if (isEditing || paymentMethodIds.length) {
        setProgress('Saving payment methods…');
        await api.setPropertyPaymentMethods(property.id, paymentMethodIds);
      }

      onSaved(property);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this property');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function toggle(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  function setParty(role: DraftParty['role'], patch: Partial<DraftParty>) {
    setParties((current) => {
      const existing = current.find((p) => p.role === role);
      if (!existing) return [...current, {userId: '', commissionPercentage: '', role, ...patch}];
      return current.map((p) => (p.role === role ? {...p, ...patch} : p));
    });
  }

  const partyFor = (role: DraftParty['role']) => parties.find((p) => p.role === role);

  return (
    <Modal
      title={isEditing ? `Edit ${loaded?.reference_code ?? 'property'}` : 'Add a property'}
      description={
        isEditing
          ? 'Correct the listing. Charges, people and photos already saved are changed straight away.'
          : 'Capture the listing, its terms, its people and its photos.'
      }
      onClose={onClose}
    >
      <nav className={styles.steps} aria-label="Form sections">
        {STEPS.map((name) => (
          <button
            key={name}
            type="button"
            className={`${styles.step} ${step === name ? styles.stepActive : ''}`}
            onClick={() => setStep(name)}
          >
            {name}
          </button>
        ))}
      </nav>

      <form onSubmit={handleSubmit} className={fieldStyles.modalBody}>
        {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}
        {progress && <p className={styles.progress}>{progress}</p>}

        {step === 'Basics' && (
          <div className={styles.grid}>
            <Field label="Title" htmlFor="p-title" className={styles.fullWidth}>
              <TextInput id="p-title" value={form.title} onChange={(e) => set('title', e.target.value)} required />
            </Field>
            <Field label="Description" htmlFor="p-description" className={styles.fullWidth}>
              <TextArea id="p-description" value={form.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
            <Field label="Listing type" htmlFor="p-listing-type">
              <Select id="p-listing-type" options={LISTING_TYPES} value={form.listingType} onChange={(e) => set('listingType', e.target.value)} />
            </Field>
            <Field label="Property type" htmlFor="p-type">
              <Select
                id="p-type"
                placeholder="Select a type"
                options={(propertyTypes.state.data?.items ?? []).map((t) => ({value: t.id, label: t.name}))}
                value={form.propertyTypeId}
                onChange={(e) => set('propertyTypeId', e.target.value)}
              />
            </Field>
            <Field label="Bedrooms" htmlFor="p-bedrooms">
              <TextInput id="p-bedrooms" type="number" min="0" max="50" value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
            </Field>
            <Field label="Bathrooms" htmlFor="p-bathrooms">
              <TextInput id="p-bathrooms" type="number" min="0" max="50" value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />
            </Field>
            <Field label="Size (sqm)" htmlFor="p-size">
              <TextInput id="p-size" type="number" min="0" value={form.sizeSqm} onChange={(e) => set('sizeSqm', e.target.value)} />
            </Field>
            <Field label="Furnishing" htmlFor="p-furnishing">
              <Select id="p-furnishing" options={FURNISHING} value={form.furnishing} onChange={(e) => set('furnishing', e.target.value)} />
            </Field>
            <Field label="Floor" htmlFor="p-floor">
              <TextInput id="p-floor" type="number" min="-5" max="200" value={form.floorNumber} onChange={(e) => set('floorNumber', e.target.value)} />
            </Field>
            <Field label="Floors in building" htmlFor="p-total-floors">
              <TextInput id="p-total-floors" type="number" min="0" max="200" value={form.totalFloors} onChange={(e) => set('totalFloors', e.target.value)} />
            </Field>
            <Field label="Year built" htmlFor="p-year">
              <TextInput id="p-year" type="number" min="1800" max="2100" value={form.yearBuilt} onChange={(e) => set('yearBuilt', e.target.value)} />
            </Field>
            <Field label="Parking spaces" htmlFor="p-parking">
              <TextInput id="p-parking" type="number" min="0" max="500" value={form.parkingSpaces} onChange={(e) => set('parkingSpaces', e.target.value)} />
            </Field>
            <Field label="Maximum occupants" htmlFor="p-occupants">
              <TextInput id="p-occupants" type="number" min="1" max="500" value={form.maxOccupants} onChange={(e) => set('maxOccupants', e.target.value)} />
            </Field>
            <label className={styles.checkbox}>
              <input type="checkbox" checked={form.petsAllowed} onChange={(e) => set('petsAllowed', e.target.checked)} />
              Pets allowed
            </label>
            <label className={styles.checkbox}>
              <input type="checkbox" checked={form.smokingAllowed} onChange={(e) => set('smokingAllowed', e.target.checked)} />
              Smoking allowed
            </label>
          </div>
        )}

        {step === 'Location' && (
          <div className={styles.grid}>
            <Field label="Region" htmlFor="p-region">
              <Select
                id="p-region"
                placeholder="Select a region"
                options={(regions.state.data?.items ?? []).map((r) => ({value: r.id, label: r.name}))}
                value={form.regionId}
                onChange={(e) => {
                  set('regionId', e.target.value);
                  set('districtId', '');
                  set('wardId', '');
                }}
              />
            </Field>
            <Field label="District" htmlFor="p-district">
              <Select
                id="p-district"
                placeholder={form.regionId ? 'Select a district' : 'Choose a region first'}
                options={(districts.state.data?.items ?? []).map((d) => ({value: d.id, label: d.name}))}
                value={form.districtId}
                onChange={(e) => {
                  set('districtId', e.target.value);
                  set('wardId', '');
                }}
                disabled={!form.regionId}
              />
            </Field>
            <Field label="Ward" htmlFor="p-ward">
              <Select
                id="p-ward"
                placeholder={form.districtId ? 'Select a ward' : 'Choose a district first'}
                options={(wards.state.data?.items ?? []).map((w) => ({value: w.id, label: w.name}))}
                value={form.wardId}
                onChange={(e) => set('wardId', e.target.value)}
                disabled={!form.districtId}
              />
            </Field>
            <Field label="Street address" htmlFor="p-address" className={styles.fullWidth}>
              <TextInput
                id="p-address"
                value={location?.addressLine ?? form.addressLine}
                onChange={(e) => {
                  set('addressLine', e.target.value);
                  if (location) setLocation({...location, addressLine: e.target.value});
                }}
              />
            </Field>
            <div className={styles.fullWidth}>
              <LocationPicker value={location} onChange={setLocation} />
            </div>
          </div>
        )}

        {step === 'Terms & pricing' && (
          <div className={styles.grid}>
            <Field label="Rent / price" htmlFor="p-price">
              <TextInput id="p-price" type="number" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
            </Field>
            <Field label="Currency" htmlFor="p-currency">
              <TextInput id="p-currency" value={form.currency} onChange={(e) => set('currency', e.target.value)} />
            </Field>
            <Field label="Payment mode" htmlFor="p-frequency">
              <Select id="p-frequency" options={PAYMENT_FREQUENCIES} value={form.paymentFrequency} onChange={(e) => set('paymentFrequency', e.target.value)} />
            </Field>
            {form.paymentFrequency === 'custom' && (
              <Field label="Months per payment" htmlFor="p-custom-months">
                <TextInput
                  id="p-custom-months"
                  type="number"
                  min="1"
                  max="120"
                  value={form.customPaymentMonths}
                  onChange={(e) => set('customPaymentMonths', e.target.value)}
                  required
                />
              </Field>
            )}
            <Field label="Deposit (months of rent)" htmlFor="p-deposit">
              <TextInput id="p-deposit" type="number" min="0" step="0.5" value={form.depositMonths} onChange={(e) => set('depositMonths', e.target.value)} />
            </Field>
            <Field label="Advance rent (months)" htmlFor="p-advance">
              <TextInput id="p-advance" type="number" min="0" step="0.5" value={form.advanceRentMonths} onChange={(e) => set('advanceRentMonths', e.target.value)} />
            </Field>
            <Field label="Minimum lease (months)" htmlFor="p-min-lease">
              <TextInput id="p-min-lease" type="number" min="1" max="120" value={form.minLeaseMonths} onChange={(e) => set('minLeaseMonths', e.target.value)} />
            </Field>
            <Field label="Maximum lease (months)" htmlFor="p-max-lease">
              <TextInput id="p-max-lease" type="number" min="1" max="120" value={form.maxLeaseMonths} onChange={(e) => set('maxLeaseMonths', e.target.value)} />
            </Field>
            <Field label="Notice period (days)" htmlFor="p-notice">
              <TextInput id="p-notice" type="number" min="0" max="365" value={form.noticePeriodDays} onChange={(e) => set('noticePeriodDays', e.target.value)} />
            </Field>
            <Field label="Available from" htmlFor="p-available">
              <TextInput id="p-available" type="date" value={form.availableFrom} onChange={(e) => set('availableFrom', e.target.value)} />
            </Field>
            <Field label="Tenancy terms" htmlFor="p-terms" className={styles.fullWidth}>
              <TextArea id="p-terms" value={form.terms} onChange={(e) => set('terms', e.target.value)} />
            </Field>
            <Field label="House rules" htmlFor="p-rules" className={styles.fullWidth}>
              <TextArea id="p-rules" value={form.houseRules} onChange={(e) => set('houseRules', e.target.value)} />
            </Field>
            <div className={styles.fullWidth}>
              <p className={styles.summary}>
                Accepted payment methods
              </p>
              <div className={styles.checkGrid}>
                {(methods.state.data?.items ?? []).map((method) => (
                  <label key={method.id} className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={paymentMethodIds.includes(method.id)}
                      onChange={() => toggle(paymentMethodIds, method.id, setPaymentMethodIds)}
                    />
                    {method.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'Amenities & charges' && (
          <div>
            <p className={styles.summary}>Amenities</p>
            <div className={styles.checkGrid}>
              {(amenityCatalogue.state.data?.items ?? []).map((amenity) => (
                <label key={amenity.id} className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={amenityIds.includes(amenity.id)}
                    onChange={() => toggle(amenityIds, amenity.id, setAmenityIds)}
                  />
                  {amenity.name}
                </label>
              ))}
            </div>

            <p className={styles.summary}>Charges besides rent</p>
            {charges.map((charge, index) => (
              <div key={index} className={styles.chargeRow}>
                <TextInput
                  aria-label={`Charge ${index + 1} name`}
                  placeholder="Service charge"
                  value={charge.name}
                  onChange={(e) =>
                    setCharges(charges.map((c, i) => (i === index ? {...c, name: e.target.value} : c)))
                  }
                />
                <TextInput
                  aria-label={`Charge ${index + 1} amount`}
                  type="number"
                  min="0"
                  placeholder="50000"
                  value={charge.amount}
                  onChange={(e) =>
                    setCharges(charges.map((c, i) => (i === index ? {...c, amount: e.target.value} : c)))
                  }
                />
                <Select
                  aria-label={`Charge ${index + 1} frequency`}
                  options={CHARGE_FREQUENCIES}
                  value={charge.frequency}
                  onChange={(e) =>
                    setCharges(charges.map((c, i) => (i === index ? {...c, frequency: e.target.value} : c)))
                  }
                />
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={charge.isMandatory}
                    onChange={(e) =>
                      setCharges(charges.map((c, i) => (i === index ? {...c, isMandatory: e.target.checked} : c)))
                    }
                  />
                  Mandatory
                </label>
                <Button type="button" variant="ghost" size="small" onClick={() => setCharges(charges.filter((_, i) => i !== index))}>
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="small"
              onClick={() =>
                setCharges([...charges, {name: '', amount: '', frequency: 'monthly', isMandatory: true, isRefundable: false}])
              }
            >
              Add a charge
            </Button>

            <p className={styles.estimate}>
              Estimated total monthly cost: <strong>{form.currency} {estimatedMonthly.toLocaleString()}</strong>
            </p>
          </div>
        )}

        {step === 'People' && (
          <div className={styles.grid}>
            <Field label="Landlord" htmlFor="p-landlord">
              <Select
                id="p-landlord"
                placeholder="Select a landlord"
                options={(landlords.state.data?.items ?? []).map((u) => ({
                  value: u.id,
                  label: `${u.full_name ?? 'Unnamed'} · ${u.phone_number ?? ''}`,
                }))}
                value={partyFor('landlord')?.userId ?? ''}
                onChange={(e) => setParty('landlord', {userId: e.target.value})}
              />
            </Field>
            <Field label="Broker" htmlFor="p-broker">
              <Select
                id="p-broker"
                placeholder="Select a broker"
                options={(brokers.state.data?.items ?? []).map((u) => ({
                  value: u.id,
                  label: `${u.full_name ?? 'Unnamed'} · ${u.phone_number ?? ''}`,
                }))}
                value={partyFor('broker')?.userId ?? ''}
                onChange={(e) => setParty('broker', {userId: e.target.value})}
              />
            </Field>
            <Field label="Broker commission %" htmlFor="p-commission">
              <TextInput
                id="p-commission"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={partyFor('broker')?.commissionPercentage ?? ''}
                onChange={(e) => setParty('broker', {commissionPercentage: e.target.value})}
              />
            </Field>
            <Field label="Agency" htmlFor="p-agency">
              <Select
                id="p-agency"
                placeholder="Select an agency contact"
                options={(agencies.state.data?.items ?? []).map((u) => ({
                  value: u.id,
                  label: `${u.full_name ?? 'Unnamed'} · ${u.organization_name ?? 'No agency'}`,
                }))}
                value={partyFor('agency')?.userId ?? ''}
                onChange={(e) => setParty('agency', {userId: e.target.value})}
              />
            </Field>
          </div>
        )}

        {step === 'Photos' && (
          <div>
            <Field label="Property photos" htmlFor="p-photos">
              <input
                id="p-photos"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => handleFiles(event.target.files)}
              />
            </Field>
            <p className={styles.hint}>
              Photos are converted to WebP in your browser — a display image and a thumbnail — before upload.
              The first photo becomes the cover.
            </p>
            {images.length > 0 && (
              <ul className={styles.photoGrid}>
                {images.map((image, index) => (
                  <li key={image.image.name + index}>
                    <img src={image.previewUrl} alt="" />
                    <span>
                      {index === 0 ? 'Cover · ' : ''}
                      {Math.round(image.originalSizeBytes / 1024)}KB → {Math.round(image.image.sizeBytes / 1024)}KB
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      onClick={() => setImages(images.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className={fieldStyles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy || (isEditing && !loaded)}>
            {busy ? 'Saving…' : isEditing ? 'Save changes' : 'Save property'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
