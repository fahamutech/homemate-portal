export type AdminAclKey =
  | 'dashboard' | 'users' | 'staff' | 'properties' | 'agencies' | 'inquiries'
  | 'viewings' | 'bookings' | 'payments' | 'dictionaries' | 'settings' | 'audit';

export interface AdminNavItem {
  path: string;
  label: string;
  title: string;
  subtitle: string;
  icon: 'dashboard' | 'users' | 'staff' | 'properties' | 'brokers' | 'payments' | 'reports' | 'settings' | 'content';
  /** Which counter from /admin/attention this entry shows, if any. */
  badge?: 'properties' | 'agencies' | 'users' | 'staff' | 'payments' | 'inquiries' | 'viewings' | 'bookings';
  /**
   * The staff ACL key this section needs (matches homemate-functions'
   * shared/admin-acl.mjs). 'dashboard' is always granted to every signed-in
   * staff account; every other section requires this key in the account's
   * `allowedRoutes` unless its role is 'admin' (unrestricted).
   */
  aclKey: AdminAclKey;
}

/** Every ACL key a non-admin staff account can be granted, for the create/edit staff form. */
export const STAFF_ACL_OPTIONS: {value: AdminAclKey; label: string}[] = [
  {value: 'users', label: 'Users'},
  {value: 'staff', label: 'Staff'},
  {value: 'properties', label: 'Properties'},
  {value: 'agencies', label: 'Agencies'},
  {value: 'inquiries', label: 'Enquiries'},
  {value: 'viewings', label: 'Viewings'},
  {value: 'bookings', label: 'Bookings'},
  {value: 'payments', label: 'Payments'},
  {value: 'dictionaries', label: 'Dictionaries'},
  {value: 'settings', label: 'Settings'},
  {value: 'audit', label: 'Audit log'},
];

/**
 * Single source of truth for the sidebar's nav list and the top bar's
 * per-page title/subtitle. Every entry here is a screen that is actually
 * built and wired to the backend.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    path: '/admin/dashboard',
    label: 'Dashboard',
    title: 'Dashboard Overview',
    subtitle: 'Real-time pulse of HomeMate Africa',
    icon: 'dashboard',
    aclKey: 'dashboard',
  },
  {
    path: '/admin/users',
    label: 'Users',
    title: 'User Management',
    subtitle: 'Customers, landlords, agencies and brokers',
    icon: 'users',
    badge: 'users',
    aclKey: 'users',
  },
  {
    path: '/admin/staff',
    label: 'Staff',
    title: 'Staff Management',
    subtitle: 'Moderators, managers, finance auditors and admins',
    icon: 'staff',
    badge: 'staff',
    aclKey: 'staff',
  },
  {
    path: '/admin/properties',
    label: 'Properties',
    title: 'Property Registry',
    subtitle: 'Review, approve and moderate listings',
    icon: 'properties',
    badge: 'properties',
    aclKey: 'properties',
  },
  {
    path: '/admin/agencies',
    label: 'Agencies',
    title: 'Agencies & Organizations',
    subtitle: 'Approve and oversee partner organizations',
    icon: 'brokers',
    badge: 'agencies',
    aclKey: 'agencies',
  },
  {
    path: '/admin/inquiries',
    label: 'Enquiries',
    title: 'Customer Enquiries',
    subtitle: 'Questions from the app, and the replies that go back',
    icon: 'content',
    badge: 'inquiries',
    aclKey: 'inquiries',
  },
  {
    path: '/admin/viewings',
    label: 'Viewings',
    title: 'Property Viewings',
    subtitle: 'Appointments customers have asked for',
    icon: 'reports',
    badge: 'viewings',
    aclKey: 'viewings',
  },
  {
    path: '/admin/bookings',
    label: 'Bookings',
    title: 'Bookings & Rentals',
    subtitle: 'What is booked, what is owed, and which tenancies are running',
    icon: 'brokers',
    badge: 'bookings',
    aclKey: 'bookings',
  },
  {
    path: '/admin/payments',
    label: 'Payments',
    title: 'Payments & Settlements',
    subtitle: 'Rent collected, split between partners, and disbursed to them',
    icon: 'payments',
    badge: 'payments',
    aclKey: 'payments',
  },
  {
    path: '/admin/dictionaries',
    label: 'Dictionaries',
    title: 'Dictionaries & Master Data',
    subtitle: 'Geography, property types, amenities and more',
    icon: 'content',
    aclKey: 'dictionaries',
  },
  {
    path: '/admin/settings',
    label: 'Settings',
    title: 'Platform Settings',
    subtitle: 'Commission, listings and operational configuration',
    icon: 'settings',
    aclKey: 'settings',
  },
  {
    path: '/admin/audit',
    label: 'Audit log',
    title: 'Audit Log',
    subtitle: 'Every change on the platform, recorded by the database',
    aclKey: 'audit',
    icon: 'reports',
  },
];
