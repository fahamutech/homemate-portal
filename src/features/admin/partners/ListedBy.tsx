import type {AdminProperty, ListedBy} from '../../../api/adminApi';
import {fieldStyles} from '../../../components/ui';

const KIND_LABEL: Record<ListedBy['kind'], string> = {broker: 'Broker', landlord: 'Landlord', backoffice: 'Backoffice'};

/** "Neema Broker" over "Broker" — who put the listing up (T04). */
export function ListedByCell({property}: {property: AdminProperty}) {
  const listedBy = property.listed_by;
  if (!listedBy) return <span>—</span>;
  return (
    <span className={fieldStyles.inlineStack}>
      <span>{listedBy.name ?? 'HomeMate staff'}</span>
      <span>{KIND_LABEL[listedBy.kind]}</span>
    </span>
  );
}
