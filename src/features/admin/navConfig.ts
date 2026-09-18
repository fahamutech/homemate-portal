export interface AdminNavItem {
  path: string;
  label: string;
  title: string;
  subtitle: string;
  icon: 'dashboard' | 'users' | 'staff' | 'properties' | 'brokers' | 'payments' | 'reports' | 'settings' | 'content';
  /** Which counter from /admin/attention this entry shows, if any. */
  badge?: 'properties' | 'agencies' | 'users' | 'staff' | 'payments' | 'inquiries' | 'viewings' | 'bookings';
}

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
  },
  {
    path: '/admin/users',
    label: 'Users',
    title: 'User Management',
    subtitle: 'Customers, landlords, agencies and brokers',
    icon: 'users',
    badge: 'users',
  },
  {
    path: '/admin/staff',
    label: 'Staff',
    title: 'Staff Management',
    subtitle: 'Moderators, managers, finance auditors and admins',
    icon: 'staff',
    badge: 'staff',
  },
  {
    path: '/admin/properties',
    label: 'Properties',
    title: 'Property Registry',
    subtitle: 'Review, approve and moderate listings',
    icon: 'properties',
    badge: 'properties',
  },
  {
    path: '/admin/agencies',
    label: 'Agencies',
    title: 'Agencies & Organizations',
    subtitle: 'Approve and oversee partner organizations',
    icon: 'brokers',
    badge: 'agencies',
  },
  {
    path: '/admin/inquiries',
    label: 'Enquiries',
    title: 'Customer Enquiries',
    subtitle: 'Questions from the app, and the replies that go back',
    icon: 'content',
    badge: 'inquiries',
  },
  {
    path: '/admin/viewings',
    label: 'Viewings',
    title: 'Property Viewings',
    subtitle: 'Appointments customers have asked for',
    icon: 'reports',
    badge: 'viewings',
  },
  {
    path: '/admin/bookings',
    label: 'Bookings',
    title: 'Bookings & Rentals',
    subtitle: 'What is booked, what is owed, and which tenancies are running',
    icon: 'brokers',
    badge: 'bookings',
  },
  {
    path: '/admin/payments',
    label: 'Payments',
    title: 'Payments & Settlements',
    subtitle: 'Rent collected, split between partners, and disbursed to them',
    icon: 'payments',
    badge: 'payments',
  },
  {
    path: '/admin/dictionaries',
    label: 'Dictionaries',
    title: 'Dictionaries & Master Data',
    subtitle: 'Geography, property types, amenities and more',
    icon: 'content',
  },
  {
    path: '/admin/settings',
    label: 'Settings',
    title: 'Platform Settings',
    subtitle: 'Commission, listings and operational configuration',
    icon: 'settings',
  },
  {
    path: '/admin/audit',
    label: 'Audit log',
    title: 'Audit Log',
    subtitle: 'Every change on the platform, recorded by the database',
    icon: 'reports',
  },
];
