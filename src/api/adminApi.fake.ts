import type {
  AdminApi, AdminOrganization, AdminProperty, AdminUser, AttentionSnapshot, AuditEntry,
  DashboardSnapshot, DictionaryItem, KycDocument, KycProfile, KycRemediation, LedgerEntry,
  BookingDetail, DeclaredPayment, Inquiry,
  OutstandingBalance, Page, PaymentAwaitingInstructions, PaymentDetail, PaymentInstructions,
  PaymentMethod, PaymentSplit, Payout, PayoutDetail, PlatformSetting, PropertyCharge,
  PropertyMedia, PropertyParty, SmsActivity, SmsBalance, Viewing,
} from './adminApi';
import {AdminApiError} from './adminApi';

function page<T>(items: T[], limit = 20, offset = 0): Page<T> {
  const slice = items.slice(offset, offset + limit);
  return {items: slice, pagination: {total: items.length, limit, offset, hasMore: offset + slice.length < items.length}};
}

export const FAKE_USERS: AdminUser[] = [
  {
    id: 'user-1', phone_number: '+255712000001', email: null, full_name: 'Amina Hassan', role: 'landlord',
    status: 'active', job_title: null, suspension_reason: null, organization_id: null, organization_name: null,
    last_login_at: null, created_at: '2026-09-01T10:00:00Z', is_staff: false,
  },
  {
    id: 'user-2', phone_number: '+255712000002', email: null, full_name: 'Juma Customer', role: 'customer',
    status: 'suspended', job_title: null, suspension_reason: 'Payment dispute', organization_id: null,
    organization_name: null, last_login_at: null, created_at: '2026-09-02T10:00:00Z', is_staff: false,
  },
];

export const FAKE_STAFF: AdminUser[] = [
  {
    id: 'staff-1', phone_number: null, email: 'amani@homemate.co.tz', full_name: 'Amani Moderator',
    role: 'moderator', status: 'active', job_title: 'Senior Moderator', suspension_reason: null,
    organization_id: null, organization_name: null, last_login_at: null,
    created_at: '2026-08-20T10:00:00Z', is_staff: true,
  },
];

export const FAKE_ORGANIZATIONS: AdminOrganization[] = [
  {
    id: 'org-1', name: 'Masaki Realty', type: 'agency', registration_number: 'BRELA-12345',
    email: 'hello@masaki.co.tz', phone_number: '+255755000001', status: 'pending', rejection_reason: null,
    verified_at: null, verified_by: null, member_count: 0, property_count: 0, created_at: '2026-09-03T10:00:00Z',
  },
];

export const FAKE_PROPERTIES: AdminProperty[] = [
  {
    id: 'prop-1', reference_code: 'HM-P-000001', title: 'Masaki 3BR Apartment', listing_type: 'rent',
    status: 'pending_review', price: '1500000.00', currency: 'TZS', bedrooms: 3, bathrooms: 2,
    address_line: 'Masaki, Dar es Salaam', rejection_reason: null, property_type_name: 'Apartment',
    region_name: 'Dar es Salaam', district_name: 'Kinondoni', ward_name: 'Masaki', owner_id: 'user-1',
    owner_name: 'Amina Hassan', organization_name: null, latitude: -6.746, longitude: 39.2803,
    media_count: 4, created_at: '2026-09-04T10:00:00Z',
    furnishing: 'semi_furnished', payment_frequency: 'quarterly', payment_months: 3,
    deposit_months: '2.0', advance_rent_months: '3.0', notice_period_days: 60,
    min_lease_months: 6, max_lease_months: 24, parking_spaces: 2, pets_allowed: true,
    total_monthly_cost: '1640000.00', one_time_charges_total: '50000.00',
    deposit_amount: '3000000.00', amount_per_instalment: '4500000.00',
    terms: 'Rent payable quarterly in advance.', house_rules: 'No loud music after 10pm.',
    landlord_name: 'Amina Hassan', broker_name: 'Neema Broker', amenity_count: 2,
  },
];

const FAKE_PAYMENT_METHODS: PaymentMethod[] = [
  {id: 'pm-1', code: 'mpesa', name: 'M-Pesa', kind: 'mobile_money', provider: 'sandbox', is_active: true, instructions: 'Pay via Lipa Namba.', config: {}, sort_order: 10},
  {id: 'pm-2', code: 'bank_transfer', name: 'Bank transfer', kind: 'bank_transfer', provider: 'manual', is_active: true, instructions: null, config: {}, sort_order: 40},
  {id: 'pm-3', code: 'cash', name: 'Cash', kind: 'cash', provider: 'manual', is_active: false, instructions: null, config: {}, sort_order: 50},
];

const FAKE_SETTINGS: PlatformSetting[] = [
  {key: 'platform.name', value: 'HomeMate Africa', category: 'general', description: 'Display name', updated_by: null, updated_at: '2026-09-01T00:00:00Z'},
  {key: 'commission.broker_percentage', value: 5, category: 'commission', description: 'Broker commission %', updated_by: null, updated_at: '2026-09-01T00:00:00Z'},
];

const FAKE_ACTIVITY: AuditEntry[] = [
  {
    id: '1', table_name: 'properties', record_id: 'prop-1', operation: 'UPDATE',
    actor: 'admin@homemate.co.tz', changed_fields: ['status'], subject: 'Masaki 3BR Apartment',
    status: 'pending_review', created_at: '2026-09-05T08:00:00Z',
  },
];

/**
 * In-memory AdminApi used by component tests and for UI work without a
 * backend. It mirrors the server's *branches* (validation refusals, illegal
 * transitions) rather than just returning happy-path data, so screens are
 * tested against the same failure modes users will hit.
 */
export function createFakeAdminApi(overrides: Partial<AdminApi> = {}): AdminApi {
  const users = [...FAKE_USERS, ...FAKE_STAFF].map((u) => ({...u}));
  const organizations = FAKE_ORGANIZATIONS.map((o) => ({...o}));
  const properties = FAKE_PROPERTIES.map((p) => ({...p}));
  const settings = FAKE_SETTINGS.map((s) => ({...s}));
  const media: PropertyMedia[] = [];
  const charges: PropertyCharge[] = [];
  const parties: PropertyParty[] = [];
  let amenities: {id: string; code: string; name: string}[] = [];
  let acceptedPaymentMethods: PaymentMethod[] = [];
  const paymentMethods = FAKE_PAYMENT_METHODS.map((m) => ({...m}));
  const dictionary: DictionaryItem[] = [
    {id: 'dict-region-1', category: 'region', code: 'dar_es_salaam', name: 'Dar es Salaam', parent_id: null, sort_order: 10, is_active: true, child_count: 1},
    {id: 'dict-district-1', category: 'district', code: 'kinondoni', name: 'Kinondoni', parent_id: 'dict-region-1', sort_order: 10, is_active: true, child_count: 0},
    {id: 'dict-type-1', category: 'property_type', code: 'apartment', name: 'Apartment', parent_id: null, sort_order: 10, is_active: true, child_count: 0},
    {id: 'dict-type-2', category: 'property_type', code: 'house', name: 'House', parent_id: null, sort_order: 20, is_active: true, child_count: 0},
  ];

  const inquiries: Inquiry[] = [
    {
      id: 'inq-1', reference: 'HM-INQ-000001', status: 'pending',
      message: 'Is this still available from November?', move_in_date: '2026-11-01',
      budget_amount: '800000', occupants: 2, contact_preference: 'whatsapp',
      response: null, responded_at: null, rejection_reason: null,
      created_at: '2026-09-18T09:00:00Z',
      property_id: 'prop-1', property_reference: 'HM-P-000001',
      property_title: 'Masaki 3BR Apartment', property_price: '1500000',
      cover_media_id: null, customer_id: 'user-2', customer_name: 'Juma Customer',
      customer_phone: '+255712000002', responded_by_name: null, owner_name: 'Amina Hassan',
      has_viewing: false, has_booking: false,
    },
  ];
  const viewings: Viewing[] = [
    {
      id: 'vw-1', reference: 'HM-VW-000001', status: 'requested',
      scheduled_for: '2026-09-25T10:00:00Z', duration_minutes: 30,
      meeting_point: 'Main gate', customer_note: null, host_note: null,
      cancellation_reason: null, confirmed_at: null, created_at: '2026-09-18T09:10:00Z',
      property_id: 'prop-1', property_reference: 'HM-P-000001',
      property_title: 'Masaki 3BR Apartment', property_address: 'Masaki, Dar es Salaam',
      cover_media_id: null, customer_id: 'user-2', customer_name: 'Juma Customer',
      customer_phone: '+255712000002', host_name: 'Amina Hassan',
      host_phone: '+255712000001', is_upcoming: true,
    },
  ];
  const bookings: BookingDetail[] = [];
  const paymentInstructions = new Map<string, PaymentInstructions>();

  const kycDocuments: (KycDocument & {user_id: string})[] = [];
  const remediations: (KycRemediation & {user_id: string})[] = [];
  const payments: PaymentDetail[] = [];
  const payouts: PayoutDetail[] = [];
  const ledger: LedgerEntry[] = [];
  let sequence = 0;

  const PAYOUT_TRANSITIONS: Record<string, string[]> = {
    scheduled: ['processing', 'on_hold', 'cancelled'],
    processing: ['paid', 'failed', 'on_hold'],
    on_hold: ['scheduled', 'cancelled'],
    failed: ['scheduled', 'cancelled'],
    paid: [],
    cancelled: [],
  };

  function kycOf(id: string): KycProfile {
    const user = users.find((u) => u.id === id);
    if (!user) throw new AdminApiError('NOT_FOUND', 'User not found', 404);
    const profile = user as KycProfile;
    profile.kyc_status ??= 'not_started';
    profile.documents = kycDocuments.filter((d) => d.user_id === id);
    profile.remediations = remediations.filter((r) => r.user_id === id);
    profile.documents_pending = String(profile.documents.filter((d) => d.status === 'pending').length);
    profile.open_remediations = String(profile.remediations.filter((r) => !r.resolved).length);
    return profile;
  }

  /** Mirrors v_outstanding_balances: settled splits not yet attached to a payout. */
  function unpaidSplits() {
    return payments
      .filter((payment) => payment.status === 'successful')
      .flatMap((payment) => payment.splits.filter((split) => !split.payout_id));
  }

  const PROPERTY_TRANSITIONS: Record<string, string[]> = {
    draft: ['pending_review', 'archived'],
    pending_review: ['approved', 'rejected', 'changes_requested', 'archived'],
    changes_requested: ['pending_review', 'archived'],
    rejected: ['pending_review', 'archived'],
    approved: ['suspended', 'archived'],
    suspended: ['approved', 'archived'],
    archived: [],
  };

  return {
    async dashboard(): Promise<DashboardSnapshot> {
      return {
        kpis: {
          totalPlatformUsers: users.filter((u) => !u.is_staff).length,
          totalStaffUsers: users.filter((u) => u.is_staff).length,
          suspendedUsers: users.filter((u) => u.status === 'suspended').length,
          activeProperties: properties.filter((p) => p.status === 'approved').length,
          pendingProperties: properties.filter((p) => p.status === 'pending_review').length,
          pendingOrganizations: organizations.filter((o) => o.status === 'pending').length,
          activeOrganizations: organizations.filter((o) => o.status === 'active').length,
          activeRentValue: 1500000,
          trends: {users: 12.5, properties: 8.2},
        },
        recentActivity: FAKE_ACTIVITY,
      };
    },

    async auditLog(params = {}) {
      const filtered = FAKE_ACTIVITY.filter((a) => !params.tableName || a.table_name === params.tableName);
      return page(filtered);
    },

    async listUsers(params = {}) {
      const staffOnly = params.staffOnly;
      const filtered = users.filter((u) => {
        if (staffOnly === true || staffOnly === 'true') return u.is_staff;
        if (staffOnly === false || staffOnly === 'false') return !u.is_staff;
        return true;
      }).filter((u) => (params.status ? u.status === params.status : true))
        .filter((u) => (params.role ? u.role === params.role : true))
        .filter((u) => (params.query
          // the server also matches the national ID, so a search for an ID
          // number finds the person holding it
          ? `${u.full_name ?? ''} ${u.email ?? ''} ${u.phone_number ?? ''} ${(u as KycProfile).national_id_number ?? ''}`
              .toLowerCase().includes(String(params.query).toLowerCase())
          : true))
        .filter((u) => (params.kycStatus
          ? ((u as KycProfile).kyc_status ?? 'not_started') === params.kycStatus
          : true))
        // search_users returns these counts, and the list column shows them, so
        // the fake has to project them rather than leaving the column empty
        .map((u) => ({
          ...u,
          kyc_status: (u as KycProfile).kyc_status ?? 'not_started',
          document_count: String(kycDocuments.filter((d) => d.user_id === u.id).length),
          documents_pending: String(
            kycDocuments.filter((d) => d.user_id === u.id && d.status === 'pending').length
          ),
          open_remediations: String(
            remediations.filter((r) => r.user_id === u.id && !r.resolved).length
          ),
        }))
        .filter((u) => (params.needsAttention === true || params.needsAttention === 'true'
          ? Number(u.documents_pending) > 0
            || Number(u.open_remediations) > 0
            || u.kyc_status === 'in_review'
          : true));
      return page(filtered, Number(params.limit ?? 20), Number(params.offset ?? 0));
    },

    async createUser(body) {
      if (!body.phoneNumber && !body.email) {
        throw new AdminApiError('VALIDATION_FAILED', 'Either phoneNumber or email is required', 400);
      }
      if (users.some((u) => u.phone_number && u.phone_number === body.phoneNumber)) {
        throw new AdminApiError('CONFLICT', 'That phone number is already registered', 409);
      }
      const isStaff = ['moderator', 'manager', 'finance_auditor', 'admin'].includes(String(body.role));
      const allowedRoutes = isStaff && body.role !== 'admin' ? ((body.allowedRoutes as string[]) ?? []) : null;
      const created: AdminUser = {
        id: `user-${users.length + 1}`,
        phone_number: (body.phoneNumber as string) ?? null,
        email: (body.email as string) ?? null,
        full_name: (body.fullName as string) ?? null,
        role: (body.role as string) ?? 'customer',
        status: isStaff ? 'pending' : 'active',
        job_title: (body.jobTitle as string) ?? null,
        suspension_reason: null,
        organization_id: (body.organizationId as string) ?? null,
        organization_name: null,
        last_login_at: null,
        created_at: new Date().toISOString(),
        is_staff: isStaff,
        allowed_routes: allowedRoutes,
        ...(isStaff ? {initial_password: 'Fake1nit-Pass'} : {}),
      };
      users.unshift(created);
      return created;
    },

    async updateUser(id, body) {
      const user = users.find((u) => u.id === id);
      if (!user) throw new AdminApiError('NOT_FOUND', 'User not found', 404);
      Object.assign(user, {
        full_name: (body.fullName as string) ?? user.full_name,
        role: (body.role as string) ?? user.role,
        job_title: body.jobTitle !== undefined ? (body.jobTitle as string) : user.job_title,
        allowed_routes: body.allowedRoutes !== undefined ? (body.allowedRoutes as string[]) : user.allowed_routes,
      });
      return user;
    },

    async changeUserStatus(id, body) {
      const user = users.find((u) => u.id === id);
      if (!user) throw new AdminApiError('NOT_FOUND', 'User not found', 404);
      if (body.status === 'suspended' && !body.reason) {
        throw new AdminApiError('VALIDATION_FAILED', 'A suspension reason is required', 400);
      }
      user.status = body.status;
      user.suspension_reason = body.status === 'suspended' ? body.reason ?? null : null;
      return user;
    },

    async listOrganizations(params = {}) {
      const filtered = organizations
        .filter((o) => (params.status ? o.status === params.status : true))
        .filter((o) => (params.query ? o.name.toLowerCase().includes(String(params.query).toLowerCase()) : true));
      return page(filtered, Number(params.limit ?? 20), Number(params.offset ?? 0));
    },

    async createOrganization(body) {
      if (!body.name) throw new AdminApiError('VALIDATION_FAILED', 'name is required', 400);
      const created: AdminOrganization = {
        id: `org-${organizations.length + 1}`,
        name: body.name as string,
        type: (body.type as string) ?? 'agency',
        registration_number: (body.registrationNumber as string) ?? null,
        email: (body.email as string) ?? null,
        phone_number: (body.phoneNumber as string) ?? null,
        status: 'pending',
        rejection_reason: null,
        verified_at: null,
        verified_by: null,
        member_count: 0,
        property_count: 0,
        created_at: new Date().toISOString(),
      };
      organizations.unshift(created);
      return created;
    },

    async changeOrganizationStatus(id, body) {
      const org = organizations.find((o) => o.id === id);
      if (!org) throw new AdminApiError('NOT_FOUND', 'Organization not found', 404);
      if (body.status === 'rejected' && !body.reason) {
        throw new AdminApiError('VALIDATION_FAILED', 'A rejection reason is required', 400);
      }
      org.status = body.status;
      org.rejection_reason = body.status === 'rejected' ? body.reason ?? null : null;
      if (body.status === 'active') org.verified_by = 'admin@homemate.co.tz';
      return org;
    },

    async listProperties(params = {}) {
      const filtered = properties
        .filter((p) => (params.status ? p.status === params.status : true))
        .filter((p) => (params.query
          ? `${p.title} ${p.reference_code}`.toLowerCase().includes(String(params.query).toLowerCase())
          : true));
      return page(filtered, Number(params.limit ?? 20), Number(params.offset ?? 0));
    },

    async getProperty(id) {
      const property = properties.find((p) => p.id === id);
      if (!property) throw new AdminApiError('NOT_FOUND', 'Property not found', 404);
      return {
        ...property,
        media: [...media],
        amenities: [...amenities],
        charges: [...charges],
        parties: [...parties],
        paymentMethods: acceptedPaymentMethods.map((m) => ({id: m.id, code: m.code, name: m.name, kind: m.kind})),
      };
    },

    async createProperty(body) {
      if (!body.title) throw new AdminApiError('VALIDATION_FAILED', 'title is required', 400);
      const created: AdminProperty = {
        ...FAKE_PROPERTIES[0],
        id: `prop-${properties.length + 1}`,
        reference_code: `HM-P-00000${properties.length + 2}`,
        title: body.title as string,
        status: 'draft',
        media_count: 0,
        created_at: new Date().toISOString(),
      };
      properties.unshift(created);
      return created;
    },

    async changePropertyStatus(id, body) {
      const property = properties.find((p) => p.id === id);
      if (!property) throw new AdminApiError('NOT_FOUND', 'Property not found', 404);
      if (['rejected', 'changes_requested'].includes(body.status) && !body.reason) {
        throw new AdminApiError('VALIDATION_FAILED', 'A reason is required', 400);
      }
      if (!PROPERTY_TRANSITIONS[property.status]?.includes(body.status)) {
        throw new AdminApiError(
          'ILLEGAL_TRANSITION',
          `Illegal property status transition: ${property.status} -> ${body.status}`,
          422
        );
      }
      property.status = body.status;
      property.rejection_reason = ['rejected', 'changes_requested'].includes(body.status) ? body.reason ?? null : null;
      return property;
    },

    async dictionaryCategories() {
      const categories = [...new Set(dictionary.map((d) => d.category))];
      return {
        items: categories.map((category) => ({
          category,
          item_count: dictionary.filter((d) => d.category === category).length,
          active_count: dictionary.filter((d) => d.category === category && d.is_active).length,
        })),
      };
    },

    async listDictionary(category, params = {}) {
      return {
        items: dictionary.filter(
          (d) => d.category === category
            && (params.includeInactive === true || params.includeInactive === 'true' ? true : d.is_active)
            && (params.parentId ? d.parent_id === params.parentId : true)
        ),
      };
    },

    async createDictionaryItem(body) {
      if (dictionary.some((d) => d.category === body.category && d.code === body.code)) {
        throw new AdminApiError('CONFLICT', 'That code already exists in this category', 409);
      }
      const created: DictionaryItem = {
        id: `dict-${dictionary.length + 1}`,
        category: body.category as string,
        code: body.code as string,
        name: body.name as string,
        parent_id: (body.parentId as string) ?? null,
        sort_order: Number(body.sortOrder ?? 0),
        is_active: true,
        child_count: 0,
      };
      dictionary.push(created);
      return created;
    },

    async updateDictionaryItem(id, body) {
      const item = dictionary.find((d) => d.id === id);
      if (!item) throw new AdminApiError('NOT_FOUND', 'Dictionary item not found', 404);
      if (body.isActive !== undefined) item.is_active = Boolean(body.isActive);
      if (body.name !== undefined) item.name = body.name as string;
      return item;
    },

    async listSettings() {
      const grouped = settings.reduce<Record<string, PlatformSetting[]>>((acc, setting) => {
        (acc[setting.category] ??= []).push(setting);
        return acc;
      }, {});
      return {items: settings, grouped};
    },

    async updateSetting(key, value) {
      const setting = settings.find((s) => s.key === key);
      if (!setting) throw new AdminApiError('NOT_FOUND', 'Setting not found', 404);
      setting.value = value;
      setting.updated_by = 'admin@homemate.co.tz';
      return setting;
    },

    async settingHistory() {
      return {items: [{old_value: 5, new_value: 7, changed_by: 'admin@homemate.co.tz', changed_at: '2026-09-05T09:00:00Z'}]};
    },

    async updateProperty(id, body) {
      const property = properties.find((p) => p.id === id);
      if (!property) throw new AdminApiError('NOT_FOUND', 'Property not found', 404);
      Object.assign(property, body);
      return property;
    },

    async assignPropertyParty(_propertyId, body) {
      if (!body.userId) throw new AdminApiError('VALIDATION_FAILED', 'userId is required', 400);
      // mirrors the database trigger: the account's role must fit the slot
      const candidate = users.find((u) => u.id === body.userId);
      const fits =
        (body.role === 'landlord' && ['landlord', 'agency'].includes(candidate?.role ?? '')) ||
        (body.role === 'broker' && candidate?.role === 'broker') ||
        (body.role === 'agency' && candidate?.role === 'agency');
      if (!fits) {
        throw new AdminApiError(
          'VALIDATION_FAILED',
          `The ${body.role} slot needs a matching account, got ${candidate?.role}`,
          422
        );
      }
      const existing = parties.findIndex((p) => p.user_id === body.userId && p.role === body.role);
      const party: PropertyParty = {
        id: existing >= 0 ? parties[existing].id : `party-${parties.length + 1}`,
        role: body.role as PropertyParty['role'],
        user_id: body.userId as string,
        full_name: candidate?.full_name ?? null,
        phone_number: candidate?.phone_number ?? null,
        email: candidate?.email ?? null,
        user_role: candidate?.role ?? '',
        commission_percentage: body.commissionPercentage ? String(body.commissionPercentage) : null,
        is_primary: Boolean(body.isPrimary),
        assigned_by: 'admin@homemate.co.tz',
        assigned_at: new Date().toISOString(),
      };
      if (existing >= 0) parties[existing] = party;
      else parties.push(party);
      return {items: [...parties]};
    },

    async removePropertyParty(_id, partyId) {
      const index = parties.findIndex((p) => p.id === partyId);
      if (index < 0) throw new AdminApiError('NOT_FOUND', 'Party assignment not found', 404);
      parties.splice(index, 1);
      return {items: [...parties]};
    },

    async setPropertyAmenities(_propertyId, amenityIds) {
      amenities = amenityIds.map((amenityId) => ({
        id: amenityId,
        code: amenityId,
        name: dictionary.find((d) => d.id === amenityId)?.name ?? amenityId,
      }));
      return {items: [...amenities]};
    },

    async addPropertyCharge(_id, body) {
      if (!body.name) throw new AdminApiError('VALIDATION_FAILED', 'name is required', 400);
      charges.push({
        id: `charge-${charges.length + 1}`,
        name: body.name as string,
        amount: String(body.amount ?? 0),
        currency: 'TZS',
        frequency: (body.frequency as string) ?? 'monthly',
        is_mandatory: body.isMandatory !== false,
        is_refundable: Boolean(body.isRefundable),
        notes: null,
        monthly_equivalent: String(body.amount ?? 0),
      });
      return {items: [...charges]};
    },

    async removePropertyCharge(_id, chargeId) {
      const index = charges.findIndex((c) => c.id === chargeId);
      if (index < 0) throw new AdminApiError('NOT_FOUND', 'Charge not found', 404);
      charges.splice(index, 1);
      return {items: [...charges]};
    },

    async uploadPropertyImage(_id, body) {
      const image = body.image as {contentType?: string; name?: string} | undefined;
      if (!image?.contentType) throw new AdminApiError('VALIDATION_FAILED', 'An image is required', 400);
      if (image.contentType !== 'image/webp') {
        throw new AdminApiError('VALIDATION_FAILED', 'Images must be WebP', 400);
      }
      media.push({
        id: `media-${media.length + 1}`,
        url: `/storage/mem/${image.name}`,
        thumbnail_url: `/storage/mem/thumb-${image.name}`,
        content_type: 'image/webp',
        caption: (body.caption as string) ?? null,
        is_cover: media.length === 0,
        width: (body.width as number) ?? null,
        height: (body.height as number) ?? null,
        position: media.length,
      });
      return {items: [...media]};
    },

    async setPropertyCoverImage(_id, mediaId) {
      media.forEach((m) => {
        m.is_cover = m.id === mediaId;
      });
      return {items: [...media]};
    },

    async removePropertyImage(_id, mediaId) {
      const index = media.findIndex((m) => m.id === mediaId);
      if (index < 0) throw new AdminApiError('NOT_FOUND', 'Image not found', 404);
      media.splice(index, 1);
      return {items: [...media]};
    },

    async setPropertyPaymentMethods(_id, paymentMethodIds) {
      acceptedPaymentMethods = paymentMethods.filter((m) => paymentMethodIds.includes(m.id));
      return {items: acceptedPaymentMethods.map((m) => ({id: m.id, name: m.name}))};
    },

    async fetchMediaBlobUrl(mediaId) {
      if (!media.some((m) => m.id === mediaId)) {
        throw new AdminApiError('MEDIA_UNAVAILABLE', 'That image could not be loaded', 404);
      }
      return `blob:fake/${mediaId}`;
    },

    async listPaymentMethods(params = {}) {
      const activeOnly = params.activeOnly === true || params.activeOnly === 'true';
      return {
        items: paymentMethods.filter((m) => (activeOnly ? m.is_active : true)),
        availableProviders: ['sandbox', 'manual'],
      };
    },

    async createPaymentMethod(body) {
      if (paymentMethods.some((m) => m.code === body.code)) {
        throw new AdminApiError('CONFLICT', 'That code already exists', 409);
      }
      if (!['sandbox', 'manual'].includes(String(body.provider ?? 'sandbox'))) {
        throw new AdminApiError(
          'VALIDATION_FAILED',
          `No PaymentPort adapter is registered for "${body.provider}"`,
          400
        );
      }
      const created: PaymentMethod = {
        id: `pm-${paymentMethods.length + 1}`,
        code: body.code as string,
        name: body.name as string,
        kind: (body.kind as string) ?? 'mobile_money',
        provider: (body.provider as string) ?? 'sandbox',
        is_active: false,
        instructions: (body.instructions as string) ?? null,
        config: {},
        sort_order: 99,
      };
      paymentMethods.push(created);
      return created;
    },

    async updatePaymentMethod(id, body) {
      const method = paymentMethods.find((m) => m.id === id);
      if (!method) throw new AdminApiError('NOT_FOUND', 'Payment method not found', 404);
      if (body.isActive !== undefined) method.is_active = Boolean(body.isActive);
      if (body.instructions !== undefined) method.instructions = body.instructions as string;
      if (body.config !== undefined) method.config = body.config as Record<string, unknown>;
      return method;
    },

    async geocode(query) {
      return {
        items: [
          {displayName: `${query}, Kinondoni, Dar es Salaam, Tanzania`, latitude: -6.746, longitude: 39.2803},
          {displayName: `${query} Road, Ilala, Dar es Salaam, Tanzania`, latitude: -6.818, longitude: 39.272},
        ],
      };
    },

    async reverseGeocode(latitude, longitude) {
      return {displayName: `Resolved address near ${latitude}, ${longitude}`, latitude, longitude};
    },

    async attention(): Promise<AttentionSnapshot> {
      const counts = {
        propertiesPendingReview: properties.filter((p) => p.status === 'pending_review').length,
        agenciesPending: organizations.filter((o) => o.status === 'pending').length,
        usersKycPending: users.filter(
          (u) => ['pending', 'in_review'].includes((u as KycProfile).kyc_status ?? 'not_started')
        ).length,
        staffPending: users.filter((u) => u.is_staff && u.status === 'pending').length,
        paymentsPending: payments.filter((p) => p.status === 'pending').length,
        paymentsFailed: payments.filter((p) => p.status === 'failed').length,
        payoutsDue: payouts.filter((p) => ['scheduled', 'processing'].includes(p.status)).length,
        payoutsBlocked: payouts.filter((p) => ['failed', 'on_hold'].includes(p.status)).length,
        openRemediations: remediations.filter((r) => !r.resolved).length,
        beneficiariesOwed: new Set(unpaidSplits().map((s) => s.beneficiary_user_id)).size,
        inquiriesPending: inquiries.filter((i) => i.status === 'pending').length,
        viewingsRequested: viewings.filter((v) => v.status === 'requested').length,
        bookingsPending: bookings.filter((b) => ['pending', 'awaiting_payment'].includes(b.status)).length,
        paymentsDeclared: payments.filter(
          (p) => p.status === 'pending' && p.customer_declared_paid_at != null
        ).length,
        paymentsNeedingInstructions: payments.filter(
          (p) => p.status === 'pending' && p.booking_id != null && !paymentInstructions.has(p.id)
        ).length,
      };
      return {
        counts,
        badges: {
          properties: counts.propertiesPendingReview,
          agencies: counts.agenciesPending,
          users: counts.usersKycPending + counts.openRemediations,
          staff: counts.staffPending,
          payments:
            counts.paymentsPending + counts.paymentsFailed + counts.payoutsDue +
            counts.payoutsBlocked + counts.paymentsDeclared + counts.paymentsNeedingInstructions,
          inquiries: counts.inquiriesPending,
          viewings: counts.viewingsRequested,
          bookings: counts.bookingsPending,
        },
      };
    },

    // --- KYC ------------------------------------------------------------------

    async getKycProfile(id) {
      return kycOf(id);
    },

    async updateKycProfile(id, body) {
      const profile = kycOf(id);
      const columns: Record<string, keyof KycProfile> = {
        dateOfBirth: 'date_of_birth', gender: 'gender', nationality: 'nationality',
        nationalIdNumber: 'national_id_number', tinNumber: 'tin_number',
        physicalAddress: 'physical_address', postalAddress: 'postal_address',
        emergencyContactName: 'emergency_contact_name', emergencyContactPhone: 'emergency_contact_phone',
        nextOfKinName: 'next_of_kin_name', nextOfKinPhone: 'next_of_kin_phone',
        bankName: 'bank_name', bankAccountName: 'bank_account_name',
        bankAccountNumber: 'bank_account_number', mobileMoneyProvider: 'mobile_money_provider',
        mobileMoneyNumber: 'mobile_money_number', notes: 'notes',
      };
      if (body.gender && !['female', 'male', 'other', 'undisclosed'].includes(String(body.gender))) {
        throw new AdminApiError('VALIDATION_FAILED', 'That gender is not one the platform records', 422);
      }
      for (const [key, column] of Object.entries(columns)) {
        if (body[key] !== undefined) (profile as unknown as Record<string, unknown>)[column] = body[key] || null;
      }
      return profile;
    },

    async reviewKyc(id, body) {
      const profile = kycOf(id);
      if (body.status === 'rejected' && !body.rejectionReason) {
        throw new AdminApiError('VALIDATION_FAILED', 'A rejection reason is required', 400);
      }
      profile.kyc_status = body.status as KycProfile['kyc_status'];
      profile.kyc_rejection_reason = body.status === 'rejected' ? body.rejectionReason ?? null : null;
      profile.kyc_expires_at = body.expiresAt ?? profile.kyc_expires_at ?? null;
      if (['verified', 'rejected'].includes(body.status)) {
        profile.kyc_reviewed_by = 'admin@homemate.co.tz';
        profile.kyc_reviewed_at = new Date().toISOString();
      }
      return profile;
    },

    async addKycDocument(id, body) {
      const profile = kycOf(id);
      const file = body.file as {base64?: string; contentType?: string; name?: string} | undefined;
      if (!file?.base64) throw new AdminApiError('VALIDATION_FAILED', 'A file is required', 400);
      const document: KycDocument & {user_id: string} = {
        id: `kycdoc-${++sequence}`,
        user_id: id,
        document_type: (body.documentType as string) ?? 'other',
        status: 'pending',
        has_thumbnail: Boolean(body.thumbnail),
        content_type: file.contentType ?? 'application/octet-stream',
        size_bytes: String(file.base64.length),
        original_filename: file.name ?? null,
        document_number: (body.documentNumber as string) ?? null,
        issued_on: (body.issuedOn as string) ?? null,
        expires_on: (body.expiresOn as string) ?? null,
        rejection_reason: null,
        reviewed_at: null,
        reviewed_by: null,
        uploaded_by: 'admin@homemate.co.tz',
        created_at: new Date().toISOString(),
      };
      kycDocuments.push(document);
      if (['not_started', 'pending'].includes(profile.kyc_status ?? 'not_started')) {
        profile.kyc_status = 'in_review';
      }
      return document;
    },

    async reviewKycDocument(documentId, body) {
      const document = kycDocuments.find((d) => d.id === documentId);
      if (!document) throw new AdminApiError('NOT_FOUND', 'Document not found', 404);
      if (body.status === 'rejected' && !body.rejectionReason) {
        throw new AdminApiError('VALIDATION_FAILED', 'A rejection reason is required', 400);
      }
      document.status = body.status as KycDocument['status'];
      document.rejection_reason = body.status === 'rejected' ? body.rejectionReason ?? null : null;
      document.reviewed_by = 'admin@homemate.co.tz';
      document.reviewed_at = new Date().toISOString();
      return document;
    },

    async deleteKycDocument(documentId) {
      const index = kycDocuments.findIndex((d) => d.id === documentId);
      if (index < 0) throw new AdminApiError('NOT_FOUND', 'Document not found', 404);
      kycDocuments.splice(index, 1);
      return {id: documentId, deleted: true};
    },

    async setProfilePhoto(id, body) {
      const profile = kycOf(id);
      const image = body.image as {base64?: string; name?: string} | undefined;
      if (!image?.base64) throw new AdminApiError('VALIDATION_FAILED', 'A file is required', 400);
      profile.profile_photo_url = `/storage/mem/${image.name ?? 'photo.webp'}`;
      profile.profile_photo_thumbnail_url = profile.profile_photo_url;
      return profile;
    },

    async openRemediation(id, body) {
      kycOf(id);
      if (!body.issue || !body.requestedAction) {
        throw new AdminApiError('VALIDATION_FAILED', 'issue and requestedAction are required', 400);
      }
      const remediation: KycRemediation & {user_id: string} = {
        id: `rem-${++sequence}`,
        user_id: id,
        kyc_document_id: body.documentId ?? null,
        issue: body.issue,
        requested_action: body.requestedAction,
        resolved: false,
        resolved_at: null,
        resolved_by: null,
        resolution_note: null,
        raised_by: 'admin@homemate.co.tz',
        created_at: new Date().toISOString(),
      };
      remediations.push(remediation);
      return remediation;
    },

    async resolveRemediation(remediationId, body) {
      const remediation = remediations.find((r) => r.id === remediationId);
      if (!remediation) throw new AdminApiError('NOT_FOUND', 'Remediation not found', 404);
      if (remediation.resolved) {
        throw new AdminApiError('VALIDATION_FAILED', 'That remediation is already resolved', 400);
      }
      remediation.resolved = true;
      remediation.resolved_at = new Date().toISOString();
      remediation.resolved_by = 'admin@homemate.co.tz';
      remediation.resolution_note = body?.resolutionNote ?? null;
      return remediation;
    },

    async fetchKycDocumentBlobUrl(documentId) {
      if (!kycDocuments.some((d) => d.id === documentId)) {
        throw new AdminApiError('MEDIA_UNAVAILABLE', 'That file could not be loaded', 404);
      }
      return `blob:fake/${documentId}`;
    },

    async fetchProfilePhotoBlobUrl(userId) {
      const profile = users.find((u) => u.id === userId) as KycProfile | undefined;
      if (!profile?.profile_photo_url) {
        throw new AdminApiError('MEDIA_UNAVAILABLE', 'That file could not be loaded', 404);
      }
      return `blob:fake/photo-${userId}`;
    },

    // --- Organizations ----------------------------------------------------------

    async updateOrganization(id, body) {
      const org = organizations.find((o) => o.id === id);
      if (!org) throw new AdminApiError('NOT_FOUND', 'Organization not found', 404);
      if (body.name !== undefined && !body.name) {
        throw new AdminApiError('VALIDATION_FAILED', 'An organization needs a name', 422);
      }
      const columns: Record<string, keyof AdminOrganization> = {
        name: 'name', registrationNumber: 'registration_number', email: 'email',
        phoneNumber: 'phone_number', type: 'type',
      };
      for (const [key, column] of Object.entries(columns)) {
        if (body[key] !== undefined) (org as unknown as Record<string, unknown>)[column] = body[key] || null;
      }
      return org;
    },

    // --- Dictionaries -----------------------------------------------------------

    async searchDictionary(params = {}) {
      const term = params.query ? String(params.query).toLowerCase() : null;
      const filtered = dictionary
        .filter((d) => (params.category ? d.category === params.category : true))
        .filter((d) => (params.parentId ? d.parent_id === params.parentId : true))
        .filter((d) =>
          params.includeInactive === true || params.includeInactive === 'true' ? true : d.is_active
        )
        .filter((d) => (term ? `${d.name} ${d.code}`.toLowerCase().includes(term) : true))
        .map((d) => ({
          ...d,
          parent_name: dictionary.find((parent) => parent.id === d.parent_id)?.name ?? null,
          in_use: dictionary.some((child) => child.parent_id === d.id),
        }));
      return page(filtered, Number(params.limit ?? 50), Number(params.offset ?? 0));
    },

    async archiveDictionaryItem(id) {
      const item = dictionary.find((d) => d.id === id);
      if (!item) throw new AdminApiError('NOT_FOUND', 'Dictionary item not found', 404);
      item.is_active = false;
      dictionary.filter((d) => d.parent_id === id).forEach((child) => {
        child.is_active = false;
      });
      return item;
    },

    async restoreDictionaryItem(id) {
      const item = dictionary.find((d) => d.id === id);
      if (!item) throw new AdminApiError('NOT_FOUND', 'Dictionary item not found', 404);
      item.is_active = true;
      return item;
    },

    async deleteDictionaryItem(id) {
      const index = dictionary.findIndex((d) => d.id === id);
      if (index < 0) throw new AdminApiError('NOT_FOUND', 'Dictionary item not found', 404);
      if (dictionary.some((d) => d.parent_id === id)) {
        throw new AdminApiError(
          'VALIDATION_FAILED',
          'This item is already used by properties or has child items — archive it instead of deleting it',
          400
        );
      }
      dictionary.splice(index, 1);
      return {id, deleted: true};
    },

    async importDictionary(body) {
      if (!body.category) throw new AdminApiError('VALIDATION_FAILED', 'category is required', 400);
      if (!body.items?.length) {
        throw new AdminApiError('VALIDATION_FAILED', 'items must be a non-empty array', 400);
      }
      // The import is atomic on the server, so validate everything before
      // touching anything — otherwise the fake would accept sheets the real
      // one rejects, and the screen would be tested against the wrong branch.
      const codes = new Set(dictionary.filter((d) => d.category === body.category).map((d) => d.code));
      body.items.forEach((row, index) => {
        if (!row.code || !row.name) {
          throw new AdminApiError('VALIDATION_FAILED', `Row ${index + 1}: code and name are required`, 400);
        }
        if (row.parentCode && !codes.has(String(row.parentCode))) {
          throw new AdminApiError(
            'VALIDATION_FAILED',
            `Row ${index + 1}: parent code "${row.parentCode}" is not in this category`,
            400
          );
        }
        codes.add(String(row.code));
      });

      const result = {created: 0, updated: 0, deactivated: 0, rows: [] as {code: string; id: string; action: 'created' | 'updated'}[]};
      const seen = new Set<string>();
      for (const row of body.items) {
        const code = String(row.code);
        const existing = dictionary.find((d) => d.category === body.category && d.code === code);
        if (existing) {
          existing.name = String(row.name);
          existing.is_active = row.isActive === undefined ? true : Boolean(row.isActive);
          result.updated += 1;
          result.rows.push({code, id: existing.id, action: 'updated'});
        } else {
          const parent = row.parentCode
            ? dictionary.find((d) => d.category === body.category && d.code === row.parentCode)
            : null;
          const created: DictionaryItem = {
            id: `dict-${++sequence}-${code}`,
            category: String(body.category),
            code,
            name: String(row.name),
            parent_id: parent?.id ?? (row.parentId as string) ?? null,
            sort_order: Number(row.sortOrder ?? 0),
            is_active: row.isActive === undefined ? true : Boolean(row.isActive),
            child_count: 0,
          };
          dictionary.push(created);
          result.created += 1;
          result.rows.push({code, id: created.id, action: 'created'});
        }
        seen.add(code);
      }
      if (body.deactivateMissing) {
        dictionary
          .filter((d) => d.category === body.category && d.is_active && !seen.has(d.code))
          .forEach((d) => {
            d.is_active = false;
            result.deactivated += 1;
          });
      }
      return result;
    },

    // --- Money -------------------------------------------------------------------

    async listPayments(params = {}) {
      const term = params.query ? String(params.query).toLowerCase() : null;
      const filtered = payments
        .filter((p) => (params.status ? p.status === params.status : true))
        .filter((p) => (params.purpose ? p.purpose === params.purpose : true))
        .filter((p) =>
          term
            ? `${p.reference} ${p.payer_name ?? ''} ${p.property_title ?? ''}`.toLowerCase().includes(term)
            : true
        );
      return page(filtered, Number(params.limit ?? 20), Number(params.offset ?? 0));
    },

    async getPayment(id) {
      const payment = payments.find((p) => p.id === id);
      if (!payment) throw new AdminApiError('NOT_FOUND', 'Payment not found', 404);
      return payment;
    },

    async recordPayment(body) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new AdminApiError('VALIDATION_FAILED', 'amount must be greater than zero', 400);
      }
      const property = properties.find((p) => p.id === body.propertyId);
      if (!property) throw new AdminApiError('VALIDATION_FAILED', 'propertyId is required', 400);

      const landlord = parties.find((party) => party.role === 'landlord') ?? null;
      const landlordId = landlord?.user_id ?? property.owner_id;
      if (!landlordId) {
        throw new AdminApiError(
          'VALIDATION_FAILED',
          'This property has no landlord on file, so the rent cannot be split',
          400
        );
      }
      const broker = parties.find((party) => party.role === 'broker');
      const platformShare = Math.round(amount * 0.1 * 100) / 100;
      const brokerShare = broker?.commission_percentage
        ? Math.round((amount * Number(broker.commission_percentage)) / 100 * 100) / 100
        : 0;
      const splits: PaymentSplit[] = [
        {id: `split-${++sequence}`, beneficiary_type: 'platform', beneficiary_user_id: null, beneficiary_name: 'HomeMate', amount: String(platformShare), percentage: '10.00', payout_id: null, payout_reference: null, payout_status: null},
      ];
      if (brokerShare > 0 && broker) {
        splits.push({id: `split-${++sequence}`, beneficiary_type: 'broker', beneficiary_user_id: broker.user_id, beneficiary_name: broker.full_name, amount: String(brokerShare), percentage: broker.commission_percentage, payout_id: null, payout_reference: null, payout_status: null});
      }
      splits.push({
        id: `split-${++sequence}`, beneficiary_type: 'landlord', beneficiary_user_id: landlordId,
        beneficiary_name: users.find((u) => u.id === landlordId)?.full_name ?? null,
        amount: String(Math.round((amount - platformShare - brokerShare) * 100) / 100),
        percentage: null, payout_id: null, payout_reference: null, payout_status: null,
      });

      const payment: PaymentDetail = {
        id: `pay-${++sequence}`,
        reference: `HM-PAY-${String(payments.length + 1).padStart(6, '0')}`,
        purpose: (body.purpose as string) ?? 'rent',
        amount: String(amount),
        currency: 'TZS',
        status: 'pending',
        provider: (body.provider as string) ?? null,
        provider_reference: null,
        period_start: (body.periodStart as string) ?? null,
        period_end: (body.periodEnd as string) ?? null,
        failure_reason: null,
        confirmed_at: null,
        confirmed_by: null,
        reconciled_at: null,
        notes: (body.notes as string) ?? null,
        created_at: new Date().toISOString(),
        property_id: property.id,
        property_reference: property.reference_code,
        property_title: property.title,
        payer_user_id: (body.payerUserId as string) ?? null,
        payer_name: users.find((u) => u.id === body.payerUserId)?.full_name ?? null,
        payer_phone: null,
        payment_method_name: null,
        split_count: String(splits.length),
        provider_event_count: '0',
        split_total: String(amount),
        splits,
        providerEvents: [],
        ledger: [],
      };
      payments.unshift(payment);
      return payment;
    },

    /** Settling posts the ledger, exactly as the database trigger does. */
    async recordProviderEvent(id, body) {
      const payment = payments.find((p) => p.id === id);
      if (!payment) throw new AdminApiError('NOT_FOUND', 'Payment not found', 404);
      const status = String(body.status ?? '');
      if (!status) throw new AdminApiError('VALIDATION_FAILED', 'status is required', 400);

      payment.providerEvents.unshift({
        id: `evt-${++sequence}`,
        provider: (body.provider as string) ?? 'unknown',
        provider_reference: (body.providerReference as string) ?? null,
        status,
        raw_payload: (body.rawPayload as Record<string, unknown>) ?? {},
        received_at: new Date().toISOString(),
      });
      payment.provider_event_count = String(payment.providerEvents.length);

      const settled = ['successful', 'success', 'completed', 'paid'].includes(status.toLowerCase())
        ? 'successful'
        : ['failed', 'failure', 'declined', 'cancelled'].includes(status.toLowerCase())
          ? 'failed'
          : null;
      if (settled === 'successful' && payment.status === 'pending') {
        settle(payment, (body.providerReference as string) ?? null);
      } else if (settled === 'failed' && payment.status === 'pending') {
        payment.status = 'failed';
        payment.failure_reason = (body.failureReason as string) ?? 'Declined by provider';
      }
      return payment;
    },

    async reconcilePayment(id, body) {
      const payment = payments.find((p) => p.id === id);
      if (!payment) throw new AdminApiError('NOT_FOUND', 'Payment not found', 404);
      if (payment.status !== 'pending') {
        throw new AdminApiError(
          'VALIDATION_FAILED',
          `Only a pending payment can be reconciled — this one is ${payment.status}`,
          400
        );
      }
      payment.reconciled_at = new Date().toISOString();
      payment.notes = body?.note ?? payment.notes;
      settle(payment, null);
      return payment;
    },

    async failPayment(id, body) {
      const payment = payments.find((p) => p.id === id);
      if (!payment) throw new AdminApiError('NOT_FOUND', 'Payment not found', 404);
      if (!body.reason) throw new AdminApiError('VALIDATION_FAILED', 'A failure reason is required', 400);
      payment.status = 'failed';
      payment.failure_reason = body.reason;
      return payment;
    },

    async moneySummary() {
      const sum = (rows: {amount: string}[]) => rows.reduce((total, row) => total + Number(row.amount), 0);
      return {
        collected: String(sum(payments.filter((p) => p.status === 'successful'))),
        pending: String(sum(payments.filter((p) => p.status === 'pending'))),
        failed: String(sum(payments.filter((p) => p.status === 'failed'))),
        successful_count: String(payments.filter((p) => p.status === 'successful').length),
        pending_count: String(payments.filter((p) => p.status === 'pending').length),
        disbursed: String(sum(payouts.filter((p) => p.status === 'paid'))),
        in_flight: String(sum(payouts.filter((p) => ['scheduled', 'processing'].includes(p.status)))),
        blocked: String(sum(payouts.filter((p) => ['on_hold', 'failed'].includes(p.status)))),
        owed: String(sum(unpaidSplits().filter((s) => s.beneficiary_type !== 'platform'))),
        beneficiaries: String(
          new Set(unpaidSplits().filter((s) => s.beneficiary_type !== 'platform').map((s) => s.beneficiary_user_id)).size
        ),
        platform_revenue: String(sum(ledger.filter((e) => e.account === 'revenue.commission'))),
      };
    },

    async outstandingBalances() {
      const grouped = new Map<string, OutstandingBalance>();
      for (const split of unpaidSplits()) {
        if (split.beneficiary_type === 'platform') continue;
        const key = `${split.beneficiary_type}:${split.beneficiary_user_id}`;
        const beneficiary = users.find((u) => u.id === split.beneficiary_user_id) as KycProfile | undefined;
        const row = grouped.get(key) ?? {
          beneficiary_type: split.beneficiary_type,
          beneficiary_user_id: split.beneficiary_user_id,
          beneficiary_name: split.beneficiary_name,
          beneficiary_phone: beneficiary?.phone_number ?? null,
          beneficiary_kyc_status: beneficiary?.kyc_status ?? 'not_started',
          bank_account_number: beneficiary?.bank_account_number ?? null,
          mobile_money_number: beneficiary?.mobile_money_number ?? null,
          split_count: '0',
          amount_due: '0',
          oldest_collection: null,
        };
        row.split_count = String(Number(row.split_count) + 1);
        row.amount_due = String(Number(row.amount_due) + Number(split.amount));
        grouped.set(key, row);
      }
      return {items: [...grouped.values()]};
    },

    async listPayouts(params = {}) {
      const term = params.query ? String(params.query).toLowerCase() : null;
      const filtered = payouts
        .filter((p) => (params.status ? p.status === params.status : true))
        .filter((p) => (params.beneficiaryType ? p.beneficiary_type === params.beneficiaryType : true))
        .filter((p) => (term ? `${p.reference} ${p.beneficiary_name ?? ''}`.toLowerCase().includes(term) : true));
      return page(filtered, Number(params.limit ?? 20), Number(params.offset ?? 0));
    },

    async getPayout(id) {
      const payout = payouts.find((p) => p.id === id);
      if (!payout) throw new AdminApiError('NOT_FOUND', 'Payout not found', 404);
      return payout;
    },

    async createPayout(body) {
      const claimable = unpaidSplits().filter(
        (split) =>
          split.beneficiary_user_id === body.beneficiaryUserId
          && split.beneficiary_type === body.beneficiaryType
      );
      if (claimable.length === 0) {
        throw new AdminApiError('VALIDATION_FAILED', 'That beneficiary has nothing outstanding', 400);
      }
      const beneficiary = users.find((u) => u.id === body.beneficiaryUserId) as KycProfile | undefined;
      const destination =
        (body.destination as string) ?? beneficiary?.mobile_money_number ?? beneficiary?.bank_account_number ?? null;
      const holdReason =
        beneficiary?.kyc_status !== 'verified'
          ? 'Beneficiary KYC is not verified'
          : !destination
            ? 'No bank account or mobile money number on file'
            : null;

      const payout: PayoutDetail = {
        id: `po-${++sequence}`,
        reference: `HM-PO-${String(payouts.length + 1).padStart(6, '0')}`,
        beneficiary_type: String(body.beneficiaryType),
        beneficiary_user_id: (body.beneficiaryUserId as string) ?? null,
        beneficiary_name: beneficiary?.full_name ?? null,
        beneficiary_phone: beneficiary?.phone_number ?? null,
        beneficiary_kyc_status: beneficiary?.kyc_status ?? 'not_started',
        amount: String(claimable.reduce((total, split) => total + Number(split.amount), 0)),
        currency: 'TZS',
        status: holdReason ? 'on_hold' : 'scheduled',
        destination,
        provider_reference: null,
        failure_reason: null,
        hold_reason: holdReason,
        scheduled_for: new Date().toISOString().slice(0, 10),
        paid_at: null,
        approved_by: null,
        created_at: new Date().toISOString(),
        payment_method_name: null,
        split_count: String(claimable.length),
        splits: claimable.map((split) => ({
          id: split.id,
          amount: split.amount,
          beneficiary_type: split.beneficiary_type,
          payment_reference: payments.find((p) => p.splits.includes(split))?.reference ?? '',
          confirmed_at: payments.find((p) => p.splits.includes(split))?.confirmed_at ?? null,
          property_reference: payments.find((p) => p.splits.includes(split))?.property_reference ?? null,
          property_title: payments.find((p) => p.splits.includes(split))?.property_title ?? null,
        })),
        ledger: [],
      };
      claimable.forEach((split) => {
        split.payout_id = payout.id;
        split.payout_reference = payout.reference;
        split.payout_status = payout.status;
      });
      payouts.unshift(payout);
      return payout;
    },

    async changePayoutStatus(id, body) {
      const payout = payouts.find((p) => p.id === id);
      if (!payout) throw new AdminApiError('NOT_FOUND', 'Payout not found', 404);
      if (body.status === 'failed' && !body.reason) {
        throw new AdminApiError('VALIDATION_FAILED', 'A failure reason is required', 400);
      }
      if (body.status === 'on_hold' && !body.reason) {
        throw new AdminApiError('VALIDATION_FAILED', 'A hold reason is required', 400);
      }
      if (!PAYOUT_TRANSITIONS[payout.status]?.includes(body.status)) {
        throw new AdminApiError(
          'ILLEGAL_TRANSITION',
          `Illegal payout status transition: ${payout.status} -> ${body.status}`,
          422
        );
      }
      payout.status = body.status as Payout['status'];
      payout.failure_reason = body.status === 'failed' ? body.reason ?? null : null;
      payout.hold_reason = body.status === 'on_hold' ? body.reason ?? null : null;
      payout.provider_reference = body.providerReference ?? payout.provider_reference;

      if (body.status === 'paid') {
        payout.paid_at = new Date().toISOString();
        payout.approved_by = 'admin@homemate.co.tz';
        const entries: LedgerEntry[] = [
          {id: `led-${++sequence}`, entry_date: new Date().toISOString(), account: `liability.payable.${payout.beneficiary_type}`, direction: 'debit', amount: payout.amount, currency: 'TZS', payout_id: payout.id, description: `Payout ${payout.reference} released`},
          {id: `led-${++sequence}`, entry_date: new Date().toISOString(), account: 'cash.disbursements', direction: 'credit', amount: payout.amount, currency: 'TZS', payout_id: payout.id, description: `Payout ${payout.reference} released`},
        ];
        payout.ledger.push(...entries);
        ledger.push(...entries);
      }
      if (body.status === 'cancelled') {
        // The money becomes payable again rather than disappearing.
        payments.flatMap((p) => p.splits).filter((s) => s.payout_id === payout.id).forEach((split) => {
          split.payout_id = null;
          split.payout_reference = null;
          split.payout_status = null;
        });
      }
      return payout;
    },

    // --- customer operations -------------------------------------------------

    async listInquiries(params = {}) {
      const term = params.query ? String(params.query).toLowerCase() : null;
      const filtered = inquiries
        .filter((i) => (params.status ? i.status === params.status : true))
        .filter((i) =>
          term
            ? `${i.reference} ${i.property_title} ${i.customer_name ?? ''} ${i.message}`
                .toLowerCase()
                .includes(term)
            : true
        );
      return page(filtered, Number(params.limit ?? 20), Number(params.offset ?? 0));
    },

    async getInquiry(id) {
      const inquiry = inquiries.find((i) => i.id === id);
      if (!inquiry) throw new AdminApiError('NOT_FOUND', 'Inquiry not found', 404);
      return inquiry;
    },

    async respondToInquiry(id, body) {
      const inquiry = inquiries.find((i) => i.id === id);
      if (!inquiry) throw new AdminApiError('NOT_FOUND', 'Inquiry not found', 404);

      const status = (body.status as string) ?? 'responded';
      if (status === 'rejected' && !body.rejectionReason) {
        throw new AdminApiError(
          'VALIDATION_FAILED',
          'Tell the customer why their enquiry was turned down',
          400
        );
      }
      if (status !== 'rejected' && !body.response) {
        throw new AdminApiError('VALIDATION_FAILED', 'Write a reply to send to the customer', 400);
      }

      inquiry.status = status;
      inquiry.response = (body.response as string) ?? inquiry.response;
      inquiry.rejection_reason = status === 'rejected' ? (body.rejectionReason as string) : null;
      inquiry.responded_at = new Date().toISOString();
      inquiry.responded_by_name = 'admin@homemate.co.tz';
      return inquiry;
    },

    async listViewings(params = {}) {
      const filtered = viewings.filter((v) => (params.status ? v.status === params.status : true));
      return page(filtered, Number(params.limit ?? 20), Number(params.offset ?? 0));
    },

    async changeViewingStatus(id, body) {
      const viewing = viewings.find((v) => v.id === id);
      if (!viewing) throw new AdminApiError('NOT_FOUND', 'Viewing not found', 404);
      if (body.status === 'cancelled' && !body.reason) {
        throw new AdminApiError(
          'VALIDATION_FAILED',
          'Tell the customer why the viewing was cancelled',
          400
        );
      }
      viewing.status = body.status as string;
      viewing.cancellation_reason = body.status === 'cancelled' ? (body.reason as string) : null;
      if (body.status === 'confirmed') viewing.confirmed_at = new Date().toISOString();
      if (body.meetingPoint) viewing.meeting_point = body.meetingPoint as string;
      return viewing;
    },

    async listBookings(params = {}) {
      const filtered = bookings.filter((b) => (params.status ? b.status === params.status : true));
      return page(filtered, Number(params.limit ?? 20), Number(params.offset ?? 0));
    },

    async getBooking(id) {
      const booking = bookings.find((b) => b.id === id);
      if (!booking) throw new AdminApiError('NOT_FOUND', 'Booking not found', 404);
      return booking;
    },

    async changeBookingStatus(id, body) {
      const booking = bookings.find((b) => b.id === id);
      if (!booking) throw new AdminApiError('NOT_FOUND', 'Booking not found', 404);
      // The database refuses this until the money has settled, so the fake
      // must too — otherwise the screen is never tested against the refusal.
      if (body.status === 'confirmed' && Number(booking.amount_paid) < Number(booking.total_due)) {
        throw new AdminApiError(
          'VALIDATION_FAILED',
          `This booking has ${booking.amount_paid} of ${booking.total_due} settled, so it cannot be confirmed yet`,
          422
        );
      }
      booking.status = body.status as string;
      return booking;
    },

    async listDeclaredPayments(params = {}) {
      const declared: DeclaredPayment[] = payments
        .filter((p) => p.status === 'pending' && p.customer_declared_paid_at != null)
        .map((p) => ({
          id: p.id,
          reference: p.reference,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          created_at: p.created_at,
          customer_declared_paid_at: p.customer_declared_paid_at!,
          customer_declared_reference: p.customer_declared_reference ?? null,
          customer_declared_note: null,
          booking_id: p.booking_id ?? null,
          booking_reference: null,
          payer_user_id: p.payer_user_id,
          payer_name: p.payer_name,
          payer_phone: p.payer_phone,
          property_reference: p.property_reference,
          property_title: p.property_title,
          account_number: paymentInstructions.get(p.id)?.account_number ?? null,
          payment_reference: paymentInstructions.get(p.id)?.payment_reference ?? null,
          display_name: paymentInstructions.get(p.id)?.display_name ?? null,
        }));
      return page(declared, Number(params.limit ?? 20), Number(params.offset ?? 0));
    },

    async listPaymentsNeedingInstructions(params = {}) {
      const waiting: PaymentAwaitingInstructions[] = payments
        .filter((p) => p.status === 'pending' && p.booking_id != null && !paymentInstructions.has(p.id))
        .map((p) => ({
          id: p.id,
          reference: p.reference,
          amount: p.amount,
          currency: p.currency,
          created_at: p.created_at,
          booking_id: p.booking_id ?? null,
          booking_reference: null,
          payer_name: p.payer_name,
          payer_phone: p.payer_phone,
          property_reference: p.property_reference,
          property_title: p.property_title,
        }));
      return page(waiting, Number(params.limit ?? 20), Number(params.offset ?? 0));
    },

    async getPaymentInstructions(paymentId) {
      return {instructions: paymentInstructions.get(paymentId) ?? null};
    },

    async setPaymentInstructions(paymentId, body) {
      const payment = payments.find((p) => p.id === paymentId);
      if (!payment) throw new AdminApiError('NOT_FOUND', 'Payment not found', 404);
      if (!body.accountNumber) {
        throw new AdminApiError('VALIDATION_FAILED', 'An account or till number is required', 400);
      }
      if (!body.paymentReference) {
        throw new AdminApiError(
          'VALIDATION_FAILED',
          'A reference for the customer to quote is required',
          400
        );
      }
      if (!body.displayName) {
        throw new AdminApiError('VALIDATION_FAILED', 'A payee name to display is required', 400);
      }

      const instructions: PaymentInstructions = {
        id: `pi-${++sequence}`,
        payment_id: paymentId,
        display_name: body.displayName as string,
        account_name: (body.accountName as string) ?? null,
        account_number: body.accountNumber as string,
        payment_reference: body.paymentReference as string,
        instructions: (body.instructions as string) ?? null,
        amount: payment.amount,
        currency: payment.currency,
        expires_at: null,
        issued_by: 'admin@homemate.co.tz',
      };
      paymentInstructions.set(paymentId, instructions);
      return instructions;
    },

    async smsBalance(): Promise<SmsBalance> {
      return {provider: 'nextsms', credits: 1240, threshold: 200, low: false};
    },

    async smsActivity(): Promise<SmsActivity> {
      return {
        activity: [
          {
            hour: '2026-09-18T09:00:00Z',
            sent: '12',
            throttled: '3',
            failed: '0',
            distinct_numbers: '9',
            distinct_ips: '7',
          },
        ],
        topRequesters: [
          {
            phone_number: '+255712000002',
            ip_address: '41.59.0.10',
            sent: '4',
            throttled: '2',
            last_seen: '2026-09-18T09:40:00Z',
          },
        ],
      };
    },

    async listLedger(params = {}) {
      const filtered = ledger.filter((e) => (params.account ? e.account === params.account : true));
      return page([...filtered].reverse(), Number(params.limit ?? 20), Number(params.offset ?? 0));
    },

    ...overrides,
  };

  /** Mirrors post_payment_to_ledger(): one debit in, one credit per share. */
  function settle(payment: PaymentDetail, providerReference: string | null) {
    payment.status = 'successful';
    payment.provider_reference = providerReference ?? payment.provider_reference;
    payment.confirmed_at = new Date().toISOString();
    payment.confirmed_by = 'admin@homemate.co.tz';
    const entries: LedgerEntry[] = [
      {id: `led-${++sequence}`, entry_date: new Date().toISOString(), account: 'cash.collections', direction: 'debit', amount: payment.amount, currency: 'TZS', payment_id: payment.id, description: `Payment ${payment.reference} received`},
      ...payment.splits.map((split): LedgerEntry => ({
        id: `led-${++sequence}`,
        entry_date: new Date().toISOString(),
        account: split.beneficiary_type === 'platform' ? 'revenue.commission' : `liability.payable.${split.beneficiary_type}`,
        direction: 'credit',
        amount: split.amount,
        currency: 'TZS',
        payment_id: payment.id,
        description: `${split.beneficiary_type} share of payment ${payment.reference}`,
      })),
    ];
    payment.ledger.push(...entries);
    ledger.push(...entries);
  }
}
