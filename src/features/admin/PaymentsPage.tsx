import {useState} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import {useResource} from '../../hooks/useResource';
import {PageSection} from '../../components/ui';
import {useAdminSearch} from './searchContext';
import {useAttention} from './attentionContext';
import {CollectionsTab, money} from './CollectionsTab';
import {PaymentQueueTab} from './PaymentQueueTab';
import {DisbursementsTab} from './DisbursementsTab';
import {LedgerTab} from './LedgerTab';
import {PaymentMethodsTab} from './PaymentMethodsTab';
import styles from './MoneyTabs.module.css';

const TABS = ['To verify', 'Collections', 'Disbursements', 'Ledger', 'Methods'] as const;
type Tab = (typeof TABS)[number];

/**
 * The money screen.
 *
 * HomeMate connects a tenant to a landlord, an agency and a broker; it does
 * not own the rent. So this screen follows one shilling all the way through:
 * collected from the tenant, split between the people owed it, disbursed to
 * them, with HomeMate's commission the only part that stays. The summary at
 * the top is that sentence as numbers, and it comes from the database rather
 * than being added up here.
 */
export function PaymentsPage() {
  const api = useAdminApi();
  const [tab, setTab] = useState<Tab>('To verify');
  const attention = useAttention();

  // The one search box in the top bar means different things per tab, which is
  // exactly what it is for: it searches what you are looking at.
  const searchTerm = useAdminSearch(
    tab === 'Disbursements' ? 'Payout reference or beneficiary' : 'Reference, payer or property'
  );

  const summary = useResource(() => api.moneySummary(), `money-summary-${attention.counts.paymentsPending ?? 0}`);
  const figures = summary.state.data;

  function refreshEverything() {
    summary.refresh();
    attention.refresh();
  }

  const pendingCount = attention.counts.paymentsPending ?? 0;
  const failedCount = attention.counts.paymentsFailed ?? 0;
  const payoutsWaiting = (attention.counts.payoutsDue ?? 0) + (attention.counts.payoutsBlocked ?? 0);
  const declaredCount = attention.counts.paymentsDeclared ?? 0;
  const needsInstructionsCount = attention.counts.paymentsNeedingInstructions ?? 0;

  return (
    <PageSection
      title="Payments"
      description="Rent collected from tenants, split between landlords, brokers and agencies, and disbursed to them."
    >
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Collected</p>
          <p className={styles.summaryValue}>{money(figures?.collected)}</p>
          <p className={styles.summaryNote}>{figures?.successful_count ?? 0} settled collections</p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Awaiting confirmation</p>
          <p className={styles.summaryValue}>{money(figures?.pending)}</p>
          <p className={styles.summaryNote}>{figures?.pending_count ?? 0} pending</p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Owed to partners</p>
          <p className={styles.summaryValue}>{money(figures?.owed)}</p>
          <p className={styles.summaryNote}>{figures?.beneficiaries ?? 0} beneficiaries</p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Disbursed</p>
          <p className={styles.summaryValue}>{money(figures?.disbursed)}</p>
          <p className={styles.summaryNote}>{money(figures?.blocked)} blocked</p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>HomeMate commission</p>
          <p className={styles.summaryValue}>{money(figures?.platform_revenue)}</p>
          <p className={styles.summaryNote}>What the platform keeps</p>
        </div>
      </div>

      <nav className={styles.tabs} aria-label="Payment sections">
        {TABS.map((name) => {
          const waiting =
            name === 'To verify' ? declaredCount + needsInstructionsCount
            : name === 'Collections' ? pendingCount + failedCount
            : name === 'Disbursements' ? payoutsWaiting
            : 0;
          return (
            <button
              key={name}
              type="button"
              className={`${styles.tab} ${tab === name ? styles.tabActive : ''}`}
              onClick={() => setTab(name)}
            >
              {name}
              {waiting > 0 && (
                <span className={styles.tabBadge} aria-label={`${waiting} need attention`}>
                  {waiting}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === 'To verify' && <PaymentQueueTab />}
      {tab === 'Collections' && (
        <CollectionsTab searchTerm={searchTerm} onChanged={refreshEverything} />
      )}
      {tab === 'Disbursements' && (
        <DisbursementsTab searchTerm={searchTerm} onChanged={refreshEverything} />
      )}
      {tab === 'Ledger' && <LedgerTab />}
      {tab === 'Methods' && <PaymentMethodsTab />}
    </PageSection>
  );
}
