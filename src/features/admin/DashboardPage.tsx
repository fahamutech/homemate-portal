import {useNavigate} from 'react-router-dom';
import {useAdminApi} from '../../api/AdminApiContext';
import {SmsCreditCard} from './SmsCreditCard';
import {useResource} from '../../hooks/useResource';
import {DataTable, PageSection, StatusBadge, humanise, fieldStyles} from '../../components/ui';
import type {AuditEntry} from '../../api/adminApi';
import usersIcon from '../../assets/icons/users.svg';
import homeIcon from '../../assets/icons/dashboard-home.svg';
import creditCardIcon from '../../assets/icons/credit-card.svg';
import clockIcon from '../../assets/icons/clock.svg';
import buildingIcon from '../../assets/icons/building.svg';
import userCheckIcon from '../../assets/icons/user-check.svg';
import styles from './DashboardPage.module.css';

/**
 * Pixel reference: Figma node 2:4072 "ADM-EXT-001 - Admin Dashboard".
 * Every number here comes from `v_admin_dashboard_kpis` — the counting is done
 * by the database in a single query, not assembled in the browser.
 */
export function DashboardPage() {
  const api = useAdminApi();
  const navigate = useNavigate();
  const {state, refresh} = useResource(() => api.dashboard(), 'dashboard');

  if (state.status === 'error') {
    return (
      <PageSection title="Dashboard">
        <div className={fieldStyles.errorBlock} role="alert">{state.error}</div>
      </PageSection>
    );
  }

  const kpis = state.data?.kpis;
  const loading = state.status === 'loading' && !state.data;

  const cards = [
    {
      label: 'Total platform users',
      value: kpis ? kpis.totalPlatformUsers.toLocaleString() : '—',
      trend: kpis?.trends.users,
      icon: usersIcon,
      iconBg: '#e0f2fe',
      to: '/admin/users',
    },
    {
      label: 'Active properties',
      value: kpis ? kpis.activeProperties.toLocaleString() : '—',
      trend: kpis?.trends.properties,
      icon: homeIcon,
      iconBg: '#dcfce7',
      to: '/admin/properties?status=approved',
    },
    {
      label: 'Listed rent value',
      value: kpis ? `TZS ${Number(kpis.activeRentValue).toLocaleString()}` : '—',
      icon: creditCardIcon,
      iconBg: '#fef9c3',
      to: '/admin/properties',
    },
    {
      label: 'Pending approvals',
      value: kpis ? String(kpis.pendingProperties + kpis.pendingOrganizations) : '—',
      icon: clockIcon,
      iconBg: '#ffedd5',
      to: '/admin/properties',
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.kpiRow}>
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            className={styles.kpiCard}
            onClick={() => navigate(card.to)}
            aria-label={`${card.label}: ${card.value}`}
          >
            <div className={styles.kpiTop}>
              <p className={styles.kpiLabel}>{card.label}</p>
              <div className={styles.kpiIcon} style={{background: card.iconBg}}>
                <img src={card.icon} alt="" width={20} height={20} />
              </div>
            </div>
            <p className={styles.kpiValue}>{loading ? '…' : card.value}</p>
            {card.trend !== undefined && (
              <div className={styles.kpiTrend}>
                <span className={card.trend >= 0 ? styles.trendUp : styles.trendDown}>
                  {card.trend >= 0 ? '+' : ''}{card.trend}%
                </span>
                <span className={styles.trendLabel}>vs last month</span>
              </div>
            )}
          </button>
        ))}
      </div>

      <div className={styles.bottomRow}>
        <div className={styles.activityCard}>
          <h3>Recent backoffice activity</h3>
          <DataTable<AuditEntry>
            status={state.status}
            rows={state.data?.recentActivity ?? []}
            emptyMessage="No activity recorded yet."
            onRetry={refresh}
            columns={[
              {key: 'subject', header: 'Subject', render: (entry) => entry.subject ?? entry.record_id},
              {key: 'record', header: 'Record', render: (entry) => humanise(entry.table_name)},
              {key: 'action', header: 'Action', render: (entry) => humanise(entry.operation)},
              {key: 'when', header: 'When', render: (entry) => new Date(entry.created_at).toLocaleString()},
              {key: 'status', header: 'Status', align: 'right', render: (entry) => <StatusBadge status={entry.status} />},
            ]}
          />
        </div>

        <div className={styles.actionsCard}>
          <h3>Required interventions</h3>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
            onClick={() => navigate('/admin/properties?status=pending_review')}
          >
            <img src={buildingIcon} alt="" width={20} height={20} />
            <div className={styles.actionText}>
              <p>Review properties</p>
              <p>{kpis ? `${kpis.pendingProperties} listings waiting approval` : 'Loading…'}</p>
            </div>
          </button>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.actionButtonDark}`}
            onClick={() => navigate('/admin/agencies?status=pending')}
          >
            <img src={userCheckIcon} alt="" width={20} height={20} />
            <div className={styles.actionText}>
              <p>Approve agencies</p>
              <p>{kpis ? `${kpis.pendingOrganizations} applications pending` : 'Loading…'}</p>
            </div>
          </button>
        </div>
      </div>

      {/* The number that decides whether anybody can sign in tomorrow. */}
      <SmsCreditCard />
    </div>
  );
}
