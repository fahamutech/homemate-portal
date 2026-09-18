export interface Page<T> {
  items: T[];
  pagination: {total: number; limit: number; offset: number; hasMore: boolean};
}

export interface AdminUser {
  id: string;
  phone_number: string | null;
  email: string | null;
  full_name: string | null;
  role: string;
  status: string;
  job_title: string | null;
  suspension_reason: string | null;
  organization_id: string | null;
  organization_name: string | null;
  last_login_at: string | null;
  created_at: string;
  is_staff: boolean;
  profile_photo_url?: string | null;
  profile_photo_thumbnail_url?: string | null;
  national_id_number?: string | null;
  kyc_status?: KycStatus;
  kyc_expires_at?: string | null;
  document_count?: string;
  documents_pending?: string;
  open_remediations?: string;
  property_count?: string;
  unpaid_balance?: string;
}

export type KycStatus = 'not_started' | 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired';

export interface KycDocument {
  id: string;
  document_type: string;
  status: 'pending' | 'verified' | 'rejected';
  has_thumbnail: boolean;
  content_type: string;
  size_bytes: string | null;
  original_filename: string | null;
  document_number: string | null;
  issued_on: string | null;
  expires_on: string | null;
  expired?: boolean;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface KycRemediation {
  id: string;
  kyc_document_id: string | null;
  issue: string;
  requested_action: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  raised_by: string | null;
  created_at: string;
}

/** Everything held on one person: the account, the identity, the evidence. */
export interface KycProfile extends AdminUser {
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  tin_number: string | null;
  physical_address: string | null;
  postal_address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  mobile_money_provider: string | null;
  mobile_money_number: string | null;
  kyc_reviewed_at: string | null;
  kyc_reviewed_by: string | null;
  kyc_rejection_reason: string | null;
  notes: string | null;
  documents: KycDocument[];
  remediations: KycRemediation[];
}

export interface PaymentSplit {
  id: string;
  beneficiary_type: 'landlord' | 'broker' | 'agency' | 'platform';
  beneficiary_user_id: string | null;
  beneficiary_name: string | null;
  amount: string;
  percentage: string | null;
  payout_id: string | null;
  payout_reference: string | null;
  payout_status: string | null;
}

export interface LedgerEntry {
  id: string;
  entry_date: string;
  account: string;
  direction: 'credit' | 'debit';
  amount: string;
  currency: string;
  payment_id?: string | null;
  payout_id?: string | null;
  description: string | null;
}

export interface ProviderEvent {
  id: string;
  provider: string;
  provider_reference: string | null;
  status: string | null;
  raw_payload: Record<string, unknown>;
  received_at: string;
}

export interface Payment {
  id: string;
  reference: string;
  purpose: string;
  amount: string;
  currency: string;
  status: 'pending' | 'successful' | 'failed' | 'reversed' | 'refunded' | 'partially_refunded';
  provider: string | null;
  provider_reference: string | null;
  period_start: string | null;
  period_end: string | null;
  failure_reason: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  reconciled_at?: string | null;
  notes?: string | null;
  created_at: string;
  booking_id?: string | null;
  booking_reference?: string | null;
  /** The customer's own claim that they have paid. It settles nothing. */
  customer_declared_paid_at?: string | null;
  customer_declared_reference?: string | null;
  has_instructions?: boolean;
  property_id: string | null;
  property_reference: string | null;
  property_title: string | null;
  payer_user_id: string | null;
  payer_name: string | null;
  payer_phone: string | null;
  payment_method_name: string | null;
  split_count: string;
  provider_event_count: string;
  split_total: string;
}

export interface PaymentDetail extends Payment {
  splits: PaymentSplit[];
  providerEvents: ProviderEvent[];
  ledger: LedgerEntry[];
}

export interface Payout {
  id: string;
  reference: string;
  beneficiary_type: string;
  beneficiary_user_id: string | null;
  beneficiary_name: string | null;
  beneficiary_phone: string | null;
  beneficiary_kyc_status: KycStatus | null;
  amount: string;
  currency: string;
  status: 'scheduled' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'on_hold';
  destination: string | null;
  provider_reference: string | null;
  failure_reason: string | null;
  hold_reason: string | null;
  scheduled_for: string | null;
  paid_at: string | null;
  approved_by: string | null;
  created_at: string;
  payment_method_name: string | null;
  split_count: string;
}

export interface PayoutDetail extends Payout {
  splits: {
    id: string;
    amount: string;
    beneficiary_type: string;
    payment_reference: string;
    confirmed_at: string | null;
    property_reference: string | null;
    property_title: string | null;
  }[];
  ledger: LedgerEntry[];
}

export interface OutstandingBalance {
  beneficiary_type: string;
  beneficiary_user_id: string | null;
  beneficiary_name: string | null;
  beneficiary_phone: string | null;
  beneficiary_kyc_status: KycStatus | null;
  bank_account_number: string | null;
  mobile_money_number: string | null;
  split_count: string;
  amount_due: string;
  oldest_collection: string | null;
}

export interface MoneySummary {
  collected: string;
  pending: string;
  failed: string;
  successful_count: string;
  pending_count: string;
  disbursed: string;
  in_flight: string;
  blocked: string;
  owed: string;
  beneficiaries: string;
  platform_revenue: string;
}

/** One number per sidebar entry, plus the raw counts behind them. */
export interface AttentionSnapshot {
  counts: Record<string, number>;
  badges: {
    properties: number;
    agencies: number;
    users: number;
    staff: number;
    payments: number;
    inquiries: number;
    viewings: number;
    bookings: number;
  };
}

/** What a customer asked about a property — CUS-007 in the app. */
export interface Inquiry {
  id: string;
  reference: string;
  status: string;
  message: string;
  move_in_date: string | null;
  budget_amount: string | null;
  occupants: number | null;
  contact_preference: string | null;
  response: string | null;
  responded_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  property_id: string;
  property_reference: string;
  property_title: string;
  property_price: string | null;
  cover_media_id: string | null;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  responded_by_name: string | null;
  owner_name: string | null;
  has_viewing: boolean;
  has_booking: boolean;
}

export interface Viewing {
  id: string;
  reference: string;
  status: string;
  scheduled_for: string;
  duration_minutes: number;
  meeting_point: string | null;
  customer_note: string | null;
  host_note: string | null;
  cancellation_reason: string | null;
  confirmed_at: string | null;
  created_at: string;
  property_id: string;
  property_reference: string;
  property_title: string;
  property_address: string | null;
  cover_media_id: string | null;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  host_name: string | null;
  host_phone: string | null;
  is_upcoming: boolean;
}

export interface Booking {
  id: string;
  reference: string;
  status: string;
  monthly_rent: string;
  currency: string;
  deposit_amount: string;
  lease_months: number | null;
  move_in_date: string | null;
  total_due: string;
  amount_paid: string;
  amount_outstanding: string;
  amount_awaiting_verification: string;
  payment_count: string;
  cancellation_reason: string | null;
  confirmed_at: string | null;
  created_at: string;
  property_id: string;
  property_reference: string;
  property_title: string;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  landlord_name: string | null;
}

export interface BookingDetail extends Booking {
  payments: CustomerFacingPayment[];
}

/** A payment as the app shows it, so the portal can see the same thing. */
export interface CustomerFacingPayment {
  id: string;
  reference: string;
  purpose: string;
  amount: string;
  currency: string;
  status: string;
  customer_state: string;
  customer_declared_paid_at: string | null;
  customer_declared_reference: string | null;
  pay_to_name: string | null;
  pay_to_account_number: string | null;
  pay_reference: string | null;
  booking_reference: string | null;
  property_title: string | null;
  created_at: string;
}

/** A payment a customer says they have made, waiting for a human to check. */
export interface DeclaredPayment {
  id: string;
  reference: string;
  amount: string;
  currency: string;
  status: string;
  created_at: string;
  customer_declared_paid_at: string;
  customer_declared_reference: string | null;
  customer_declared_note: string | null;
  booking_id: string | null;
  booking_reference: string | null;
  payer_user_id: string | null;
  payer_name: string | null;
  payer_phone: string | null;
  property_reference: string | null;
  property_title: string | null;
  account_number: string | null;
  payment_reference: string | null;
  display_name: string | null;
}

export interface PaymentAwaitingInstructions {
  id: string;
  reference: string;
  amount: string;
  currency: string;
  created_at: string;
  booking_id: string | null;
  booking_reference: string | null;
  payer_name: string | null;
  payer_phone: string | null;
  property_reference: string | null;
  property_title: string | null;
}

export interface PaymentInstructions {
  id: string;
  payment_id: string;
  display_name: string;
  account_name: string | null;
  account_number: string;
  payment_reference: string;
  instructions: string | null;
  amount: string;
  currency: string;
  expires_at: string | null;
  issued_by: string | null;
}

/** SMS credit, so an OTP journey does not fail silently when it runs out. */
export interface SmsBalance {
  provider: string;
  credits: number | null;
  threshold: number;
  low: boolean;
}

export interface SmsActivity {
  activity: {
    hour: string;
    sent: string;
    throttled: string;
    failed: string;
    distinct_numbers: string;
    distinct_ips: string;
  }[];
  topRequesters: {
    phone_number: string | null;
    ip_address: string | null;
    sent: string;
    throttled: string;
    last_seen: string;
  }[];
}

export interface DictionaryImportResult {
  created: number;
  updated: number;
  deactivated: number;
  rows: {code: string; id: string; action: 'created' | 'updated'}[];
}

export interface AdminOrganization {
  id: string;
  name: string;
  type: string;
  registration_number: string | null;
  email: string | null;
  phone_number: string | null;
  status: string;
  rejection_reason: string | null;
  verified_at: string | null;
  verified_by: string | null;
  member_count: number;
  property_count: number;
  created_at: string;
}

export interface PropertyMedia {
  id: string;
  url: string;
  thumbnail_url: string | null;
  content_type: string;
  caption: string | null;
  is_cover: boolean;
  width: number | null;
  height: number | null;
  position: number;
}

export interface PropertyCharge {
  id: string;
  name: string;
  amount: string;
  currency: string;
  frequency: string;
  is_mandatory: boolean;
  is_refundable: boolean;
  notes: string | null;
  monthly_equivalent: string;
}

export interface PropertyParty {
  id: string;
  role: 'landlord' | 'broker' | 'agency';
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  email: string | null;
  user_role: string;
  commission_percentage: string | null;
  is_primary: boolean;
  assigned_by: string | null;
  assigned_at: string;
}

export interface AdminProperty {
  id: string;
  reference_code: string;
  title: string;
  description?: string | null;
  listing_type: string;
  status: string;
  price: string | null;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm?: string | null;
  address_line: string | null;
  rejection_reason: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  submitted_at?: string | null;
  property_type_name: string | null;
  property_type_id?: string | null;
  region_name: string | null;
  region_id?: string | null;
  district_name: string | null;
  district_id?: string | null;
  ward_name: string | null;
  ward_id?: string | null;
  owner_id: string | null;
  owner_name: string | null;
  landlord_name?: string | null;
  broker_name?: string | null;
  organization_id?: string | null;
  organization_name: string | null;
  latitude: number | null;
  longitude: number | null;
  media_count: number;
  amenity_count?: number;
  cover_media_id?: string | null;
  distance_metres?: number | null;
  created_at: string;

  // lease & payment terms
  furnishing?: string;
  floor_number?: number | null;
  total_floors?: number | null;
  year_built?: number | null;
  parking_spaces?: number;
  max_occupants?: number | null;
  pets_allowed?: boolean;
  smoking_allowed?: boolean;
  available_from?: string | null;
  min_lease_months?: number;
  max_lease_months?: number | null;
  payment_frequency?: string;
  custom_payment_months?: number | null;
  payment_months?: number;
  deposit_months?: string;
  advance_rent_months?: string;
  notice_period_days?: number;
  terms?: string | null;
  house_rules?: string | null;
  total_monthly_cost?: string;
  one_time_charges_total?: string;
  deposit_amount?: string;
  amount_per_instalment?: string;
}

export interface AdminPropertyDetail extends AdminProperty {
  media: PropertyMedia[];
  amenities: {id: string; code: string; name: string}[];
  charges: PropertyCharge[];
  parties: PropertyParty[];
  paymentMethods: {id: string; code: string; name: string; kind: string}[];
}

export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  kind: string;
  provider: string;
  is_active: boolean;
  instructions: string | null;
  config: Record<string, unknown>;
  sort_order: number;
}

export interface GeocodeResult {
  displayName: string;
  latitude: number;
  longitude: number;
  type?: string;
}

export interface DictionaryItem {
  id: string;
  category: string;
  code: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  child_count: number;
  /** Only from the search endpoint, which resolves the parent and the references. */
  parent_name?: string | null;
  in_use?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PlatformSetting {
  key: string;
  value: unknown;
  category: string;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  operation: string;
  actor: string | null;
  changed_fields: string[] | null;
  subject: string | null;
  status: string | null;
  created_at: string;
}

export interface DashboardSnapshot {
  kpis: {
    totalPlatformUsers: number;
    totalStaffUsers: number;
    suspendedUsers: number;
    activeProperties: number;
    pendingProperties: number;
    pendingOrganizations: number;
    activeOrganizations: number;
    activeRentValue: number;
    trends: {users: number; properties: number};
  };
  recentActivity: AuditEntry[];
}

export class AdminApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Every admin screen talks to the backend through this one interface, so
 * pages never touch `fetch`, URLs or auth headers — and component tests
 * swap in `createFakeAdminApi` without any network stubbing.
 */
export interface AdminApi {
  dashboard(): Promise<DashboardSnapshot>;
  auditLog(params?: Record<string, unknown>): Promise<Page<AuditEntry>>;

  attention(): Promise<AttentionSnapshot>;

  listUsers(params?: Record<string, unknown>): Promise<Page<AdminUser>>;
  createUser(body: Record<string, unknown>): Promise<AdminUser>;
  updateUser(id: string, body: Record<string, unknown>): Promise<AdminUser>;
  changeUserStatus(id: string, body: {status: string; reason?: string}): Promise<AdminUser>;

  getKycProfile(id: string): Promise<KycProfile>;
  updateKycProfile(id: string, body: Record<string, unknown>): Promise<KycProfile>;
  reviewKyc(id: string, body: {status: string; rejectionReason?: string; expiresAt?: string}): Promise<KycProfile>;
  addKycDocument(id: string, body: Record<string, unknown>): Promise<KycDocument>;
  reviewKycDocument(documentId: string, body: {status: string; rejectionReason?: string}): Promise<KycDocument>;
  deleteKycDocument(documentId: string): Promise<{id: string; deleted: boolean}>;
  setProfilePhoto(id: string, body: Record<string, unknown>): Promise<KycProfile>;
  openRemediation(id: string, body: {issue: string; requestedAction: string; documentId?: string}): Promise<KycRemediation>;
  resolveRemediation(remediationId: string, body?: {resolutionNote?: string}): Promise<KycRemediation>;
  /** Resolves to an object URL; the caller revokes it when done. */
  fetchKycDocumentBlobUrl(documentId: string, options?: {thumbnail?: boolean}): Promise<string>;
  fetchProfilePhotoBlobUrl(userId: string, options?: {thumbnail?: boolean}): Promise<string>;

  listOrganizations(params?: Record<string, unknown>): Promise<Page<AdminOrganization>>;
  createOrganization(body: Record<string, unknown>): Promise<AdminOrganization>;
  updateOrganization(id: string, body: Record<string, unknown>): Promise<AdminOrganization>;
  changeOrganizationStatus(id: string, body: {status: string; reason?: string}): Promise<AdminOrganization>;

  listProperties(params?: Record<string, unknown>): Promise<Page<AdminProperty>>;
  getProperty(id: string): Promise<AdminPropertyDetail>;
  createProperty(body: Record<string, unknown>): Promise<AdminProperty>;
  updateProperty(id: string, body: Record<string, unknown>): Promise<AdminProperty>;
  changePropertyStatus(id: string, body: {status: string; reason?: string}): Promise<AdminProperty>;

  assignPropertyParty(id: string, body: Record<string, unknown>): Promise<{items: PropertyParty[]}>;
  removePropertyParty(id: string, partyId: string): Promise<{items: PropertyParty[]}>;
  setPropertyAmenities(id: string, amenityIds: string[]): Promise<{items: {id: string; name: string}[]}>;
  addPropertyCharge(id: string, body: Record<string, unknown>): Promise<{items: PropertyCharge[]}>;
  removePropertyCharge(id: string, chargeId: string): Promise<{items: PropertyCharge[]}>;
  uploadPropertyImage(id: string, body: Record<string, unknown>): Promise<{items: PropertyMedia[]}>;
  setPropertyCoverImage(id: string, mediaId: string): Promise<{items: PropertyMedia[]}>;
  removePropertyImage(id: string, mediaId: string): Promise<{items: PropertyMedia[]}>;
  setPropertyPaymentMethods(id: string, paymentMethodIds: string[]): Promise<{items: {id: string; name: string}[]}>;
  /** Resolves to an object URL; the caller revokes it when done. */
  fetchMediaBlobUrl(mediaId: string, options?: {thumbnail?: boolean}): Promise<string>;

  listPaymentMethods(params?: Record<string, unknown>): Promise<{items: PaymentMethod[]; availableProviders: string[]}>;
  createPaymentMethod(body: Record<string, unknown>): Promise<PaymentMethod>;
  updatePaymentMethod(id: string, body: Record<string, unknown>): Promise<PaymentMethod>;

  geocode(query: string): Promise<{items: GeocodeResult[]}>;
  reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult | null>;

  dictionaryCategories(): Promise<{items: {category: string; item_count: number; active_count: number}[]}>;
  listDictionary(category: string, params?: Record<string, unknown>): Promise<{items: DictionaryItem[]}>;
  searchDictionary(params?: Record<string, unknown>): Promise<Page<DictionaryItem>>;
  createDictionaryItem(body: Record<string, unknown>): Promise<DictionaryItem>;
  updateDictionaryItem(id: string, body: Record<string, unknown>): Promise<DictionaryItem>;
  archiveDictionaryItem(id: string): Promise<DictionaryItem>;
  restoreDictionaryItem(id: string): Promise<DictionaryItem>;
  deleteDictionaryItem(id: string): Promise<{id: string; deleted: boolean}>;
  importDictionary(body: {category: string; items: Record<string, unknown>[]; deactivateMissing?: boolean}): Promise<DictionaryImportResult>;

  listPayments(params?: Record<string, unknown>): Promise<Page<Payment>>;
  getPayment(id: string): Promise<PaymentDetail>;
  recordPayment(body: Record<string, unknown>): Promise<PaymentDetail>;
  recordProviderEvent(id: string, body: Record<string, unknown>): Promise<PaymentDetail>;
  reconcilePayment(id: string, body?: {note?: string}): Promise<PaymentDetail>;
  failPayment(id: string, body: {reason: string}): Promise<PaymentDetail>;
  moneySummary(): Promise<MoneySummary>;
  outstandingBalances(): Promise<{items: OutstandingBalance[]}>;
  listPayouts(params?: Record<string, unknown>): Promise<Page<Payout>>;
  getPayout(id: string): Promise<PayoutDetail>;
  createPayout(body: Record<string, unknown>): Promise<PayoutDetail>;
  changePayoutStatus(id: string, body: {status: string; reason?: string; providerReference?: string}): Promise<PayoutDetail>;
  listLedger(params?: Record<string, unknown>): Promise<Page<LedgerEntry>>;

  listInquiries(params?: Record<string, unknown>): Promise<Page<Inquiry>>;
  getInquiry(id: string): Promise<Inquiry>;
  respondToInquiry(id: string, body: Record<string, unknown>): Promise<Inquiry>;

  listViewings(params?: Record<string, unknown>): Promise<Page<Viewing>>;
  changeViewingStatus(id: string, body: Record<string, unknown>): Promise<Viewing>;

  listBookings(params?: Record<string, unknown>): Promise<Page<Booking>>;
  getBooking(id: string): Promise<BookingDetail>;
  changeBookingStatus(id: string, body: Record<string, unknown>): Promise<BookingDetail>;

  listDeclaredPayments(params?: Record<string, unknown>): Promise<Page<DeclaredPayment>>;
  listPaymentsNeedingInstructions(params?: Record<string, unknown>): Promise<Page<PaymentAwaitingInstructions>>;
  getPaymentInstructions(paymentId: string): Promise<{instructions: PaymentInstructions | null}>;
  setPaymentInstructions(paymentId: string, body: Record<string, unknown>): Promise<PaymentInstructions>;

  smsBalance(): Promise<SmsBalance>;
  smsActivity(): Promise<SmsActivity>;

  listSettings(): Promise<{items: PlatformSetting[]; grouped: Record<string, PlatformSetting[]>}>;
  updateSetting(key: string, value: unknown): Promise<PlatformSetting>;
  settingHistory(key: string): Promise<{items: {old_value: unknown; new_value: unknown; changed_by: string | null; changed_at: string}[]}>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

function toQueryString(params: Record<string, unknown> = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function createHttpAdminApi(token: string, baseUrl: string = API_BASE_URL): AdminApi {
  async function request<T>(path: string, {method = 'GET', body}: {method?: string; body?: unknown} = {}): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? {'content-type': 'application/json'} : {}),
      },
      ...(body ? {body: JSON.stringify(body)} : {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AdminApiError(payload.error ?? 'UNKNOWN_ERROR', payload.message ?? response.statusText, response.status);
    }
    return payload as T;
  }

  /**
   * Storage has its own credentials, so files come back through our API. They
   * are fetched with the Authorization header and handed to <img> as an object
   * URL — putting the session token in the URL instead would leak it into
   * browser history, referrers and server logs.
   */
  async function blobUrl(path: string, options: {thumbnail?: boolean} = {}) {
    const response = await fetch(
      `${baseUrl}${path}${toQueryString({thumbnail: options.thumbnail ? '1' : undefined})}`,
      {headers: {authorization: `Bearer ${token}`}}
    );
    if (!response.ok) {
      throw new AdminApiError('MEDIA_UNAVAILABLE', 'That file could not be loaded', response.status);
    }
    return URL.createObjectURL(await response.blob());
  }

  return {
    dashboard: () => request('/admin/dashboard'),
    auditLog: (params) => request(`/admin/audit${toQueryString(params)}`),

    attention: () => request('/admin/attention'),

    listUsers: (params) => request(`/admin/users${toQueryString(params)}`),
    createUser: (body) => request('/admin/users', {method: 'POST', body}),
    updateUser: (id, body) => request(`/admin/users/${id}`, {method: 'PATCH', body}),
    changeUserStatus: (id, body) => request(`/admin/users/${id}/status`, {method: 'POST', body}),

    getKycProfile: (id) => request(`/admin/users/${id}/kyc`),
    updateKycProfile: (id, body) => request(`/admin/users/${id}/kyc`, {method: 'PATCH', body}),
    reviewKyc: (id, body) => request(`/admin/users/${id}/kyc/review`, {method: 'POST', body}),
    addKycDocument: (id, body) => request(`/admin/users/${id}/kyc/documents`, {method: 'POST', body}),
    reviewKycDocument: (documentId, body) =>
      request(`/admin/kyc/documents/${documentId}/review`, {method: 'POST', body}),
    deleteKycDocument: (documentId) => request(`/admin/kyc/documents/${documentId}`, {method: 'DELETE'}),
    setProfilePhoto: (id, body) => request(`/admin/users/${id}/photo`, {method: 'PUT', body}),
    openRemediation: (id, body) => request(`/admin/users/${id}/kyc/remediations`, {method: 'POST', body}),
    resolveRemediation: (remediationId, body) =>
      request(`/admin/kyc/remediations/${remediationId}/resolve`, {method: 'POST', body: body ?? {}}),
    fetchKycDocumentBlobUrl: (documentId, options = {}) =>
      blobUrl(`/admin/kyc/documents/${documentId}/raw`, options),
    fetchProfilePhotoBlobUrl: (userId, options = {}) =>
      blobUrl(`/admin/users/${userId}/photo/raw`, options),

    listOrganizations: (params) => request(`/admin/organizations${toQueryString(params)}`),
    createOrganization: (body) => request('/admin/organizations', {method: 'POST', body}),
    updateOrganization: (id, body) => request(`/admin/organizations/${id}`, {method: 'PATCH', body}),
    changeOrganizationStatus: (id, body) => request(`/admin/organizations/${id}/status`, {method: 'POST', body}),

    listProperties: (params) => request(`/admin/properties${toQueryString(params)}`),
    getProperty: (id) => request(`/admin/properties/${id}`),
    createProperty: (body) => request('/admin/properties', {method: 'POST', body}),
    updateProperty: (id, body) => request(`/admin/properties/${id}`, {method: 'PATCH', body}),
    changePropertyStatus: (id, body) => request(`/admin/properties/${id}/status`, {method: 'POST', body}),

    assignPropertyParty: (id, body) => request(`/admin/properties/${id}/parties`, {method: 'POST', body}),
    removePropertyParty: (id, partyId) =>
      request(`/admin/properties/${id}/parties/${partyId}`, {method: 'DELETE'}),
    setPropertyAmenities: (id, amenityIds) =>
      request(`/admin/properties/${id}/amenities`, {method: 'PUT', body: {amenityIds}}),
    addPropertyCharge: (id, body) => request(`/admin/properties/${id}/charges`, {method: 'POST', body}),
    removePropertyCharge: (id, chargeId) =>
      request(`/admin/properties/${id}/charges/${chargeId}`, {method: 'DELETE'}),
    uploadPropertyImage: (id, body) => request(`/admin/properties/${id}/media`, {method: 'POST', body}),
    setPropertyCoverImage: (id, mediaId) =>
      request(`/admin/properties/${id}/media/${mediaId}/cover`, {method: 'POST'}),
    removePropertyImage: (id, mediaId) =>
      request(`/admin/properties/${id}/media/${mediaId}`, {method: 'DELETE'}),
    setPropertyPaymentMethods: (id, paymentMethodIds) =>
      request(`/admin/properties/${id}/payment-methods`, {method: 'PUT', body: {paymentMethodIds}}),

    fetchMediaBlobUrl: (mediaId, options = {}) => blobUrl(`/admin/media/${mediaId}/raw`, options),

    listPaymentMethods: (params) => request(`/admin/payment-methods${toQueryString(params)}`),
    createPaymentMethod: (body) => request('/admin/payment-methods', {method: 'POST', body}),
    updatePaymentMethod: (id, body) => request(`/admin/payment-methods/${id}`, {method: 'PATCH', body}),

    geocode: (query) => request(`/admin/geocode${toQueryString({q: query})}`),
    reverseGeocode: async (latitude, longitude) => {
      const response = await request<{result: GeocodeResult | null}>(
        `/admin/geocode/reverse${toQueryString({latitude, longitude})}`
      );
      return response.result;
    },

    dictionaryCategories: () => request('/admin/dictionaries'),
    listDictionary: (category, params) => request(`/admin/dictionaries/${category}${toQueryString(params)}`),
    createDictionaryItem: (body) => request('/admin/dictionaries', {method: 'POST', body}),
    searchDictionary: (params) => request(`/admin/dictionary-items${toQueryString(params)}`),
    updateDictionaryItem: (id, body) => request(`/admin/dictionaries/item/${id}`, {method: 'PATCH', body}),
    archiveDictionaryItem: (id) => request(`/admin/dictionaries/item/${id}/archive`, {method: 'POST'}),
    restoreDictionaryItem: (id) => request(`/admin/dictionaries/item/${id}/restore`, {method: 'POST'}),
    deleteDictionaryItem: (id) => request(`/admin/dictionaries/item/${id}`, {method: 'DELETE'}),
    importDictionary: (body) => request('/admin/dictionary-items/import', {method: 'POST', body}),

    listPayments: (params) => request(`/admin/payments${toQueryString(params)}`),
    getPayment: (id) => request(`/admin/payments/${id}`),
    recordPayment: (body) => request('/admin/payments', {method: 'POST', body}),
    recordProviderEvent: (id, body) => request(`/admin/payments/${id}/provider-events`, {method: 'POST', body}),
    reconcilePayment: (id, body) => request(`/admin/payments/${id}/reconcile`, {method: 'POST', body: body ?? {}}),
    failPayment: (id, body) => request(`/admin/payments/${id}/fail`, {method: 'POST', body}),
    moneySummary: () => request('/admin/money/summary'),
    outstandingBalances: () => request('/admin/money/outstanding'),
    listPayouts: (params) => request(`/admin/payouts${toQueryString(params)}`),
    getPayout: (id) => request(`/admin/payouts/${id}`),
    createPayout: (body) => request('/admin/payouts', {method: 'POST', body}),
    changePayoutStatus: (id, body) => request(`/admin/payouts/${id}/status`, {method: 'POST', body}),
    listLedger: (params) => request(`/admin/ledger${toQueryString(params)}`),

    listInquiries: (params) => request(`/admin/inquiries${toQueryString(params)}`),
    getInquiry: (id) => request(`/admin/inquiries/${id}`),
    respondToInquiry: (id, body) => request(`/admin/inquiries/${id}/respond`, {method: 'POST', body}),

    listViewings: (params) => request(`/admin/viewings${toQueryString(params)}`),
    changeViewingStatus: (id, body) => request(`/admin/viewings/${id}/status`, {method: 'POST', body}),

    listBookings: (params) => request(`/admin/bookings${toQueryString(params)}`),
    getBooking: (id) => request(`/admin/bookings/${id}`),
    changeBookingStatus: (id, body) => request(`/admin/bookings/${id}/status`, {method: 'POST', body}),

    listDeclaredPayments: (params) => request(`/admin/payment-queue/declared${toQueryString(params)}`),
    listPaymentsNeedingInstructions: (params) =>
      request(`/admin/payment-queue/needs-instructions${toQueryString(params)}`),
    getPaymentInstructions: (paymentId) => request(`/admin/payments/${paymentId}/instructions`),
    setPaymentInstructions: (paymentId, body) =>
      request(`/admin/payments/${paymentId}/instructions`, {method: 'PUT', body}),

    smsBalance: () => request('/admin/sms/balance'),
    smsActivity: () => request('/admin/sms/activity'),

    listSettings: () => request('/admin/settings'),
    updateSetting: (key, value) => request(`/admin/settings/${key}`, {method: 'PATCH', body: {value}}),
    settingHistory: (key) => request(`/admin/settings/${key}/history`),
  };
}
