import type {KycStatus, LandlordConfirmationStatus, ListedBy, RoleStatus} from '../../../api/adminApi';

/** How partner-role words read in the console (sentence case, as the Figma backoffice). */
export const ROLE_STATUS_LABEL: Record<RoleStatus, string> = {
  invited: 'Invited',
  applied: 'Applied',
  pending_review: 'Pending review',
  active: 'Active',
  action_needed: 'Action needed',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

export const KYC_STATUS_LABEL: Record<KycStatus, string> = {
  not_started: 'Not started',
  pending: 'Pending',
  in_review: 'In review',
  verified: 'Verified',
  rejected: 'Rejected',
  expired: 'Expired',
};

export const CONFIRMATION_LABEL: Record<LandlordConfirmationStatus, string> = {
  not_required: 'Not needed',
  pending: 'Waiting',
  confirmed: 'Confirmed',
  disputed: 'Disputed',
};

export const ROLE_LABEL = {customer: 'Customer', broker: 'Broker', landlord: 'Landlord'} as const;

export const DOCUMENT_LABEL: Record<string, string> = {
  national_id: 'National ID',
  passport: 'Passport',
  drivers_licence: "Driver's licence",
  voters_id: "Voter's ID",
  selfie: 'Selfie',
  title_deed: 'Title deed',
  utility_bill: 'Utility bill',
};

export const STEP_LABEL: Record<string, string> = {
  details: 'Your details',
  identity: 'Identity',
  ownership: 'Ownership proof',
  payout: 'Getting paid',
  agreement: 'Agreement',
};

/** Statuses the queue filters by (T08). */
export const QUEUE_STATUSES: {value: RoleStatus; label: string}[] = [
  {value: 'pending_review', label: 'Pending review'},
  {value: 'action_needed', label: 'Action needed'},
  {value: 'active', label: 'Active'},
  {value: 'rejected', label: 'Rejected'},
  {value: 'suspended', label: 'Suspended'},
];

/** Ownership proof documents a landlord files (T03). */
export const OWNERSHIP_DOCUMENTS = ['title_deed', 'utility_bill'];

/** "Listed by Neema Broker (broker)" — who put a listing up (T04). */
export function listedBySentence(listedBy: ListedBy | undefined) {
  if (!listedBy || listedBy.kind === 'backoffice') return 'Listed from the backoffice';
  return `Listed by ${listedBy.name ?? 'a partner'} (${listedBy.kind})`;
}

/**
 * The Landlord column on Properties. `not_required` means the listing has no
 * landlord to ask: fine for a landlord's own or a backoffice listing, but on a
 * broker's listing it means the landlord has not been attached yet.
 */
export function landlordColumnLabel(listedBy: ListedBy | undefined, status: LandlordConfirmationStatus) {
  if (status === 'not_required' && listedBy?.kind === 'broker') return 'No landlord yet';
  return CONFIRMATION_LABEL[status];
}
