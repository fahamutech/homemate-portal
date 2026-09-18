import {useAdminApi} from '../../api/AdminApiContext';
import {useResource} from '../../hooks/useResource';
import {Card, fieldStyles} from '../../components/ui';
import styles from './DashboardPage.module.css';

/**
 * How much SMS credit is left.
 *
 * Every verification code costs one. When the account runs dry, customers do
 * not see "out of credit" — they see a login that silently fails, which looks
 * exactly like the app being broken. So the number is shown before it becomes
 * an incident, with the threshold the platform was configured to warn at.
 */
export function SmsCreditCard() {
  const api = useAdminApi();
  const {state} = useResource(() => api.smsBalance(), 'sms-balance');
  const balance = state.data;

  if (state.status === 'error') return null;

  // The sandbox adapter has no credit to run out of; a made-up number would be
  // worse than saying so.
  const isSandbox = balance != null && balance.credits == null;

  return (
    <Card>
      <h3 className={fieldStyles.cardTitle}>SMS credit</h3>
      {balance == null ? (
        <p className={fieldStyles.hint}>Checking…</p>
      ) : isSandbox ? (
        <p className={fieldStyles.hint}>
          Running on the <code>{balance.provider}</code> adapter — no real messages are sent and
          there is no balance to track.
        </p>
      ) : (
        <>
          <p
            className={styles.kpiValue}
            style={{color: balance.low ? 'var(--color-danger-text)' : undefined}}
          >
            {balance.credits?.toLocaleString()}
          </p>
          <p className={fieldStyles.hint}>
            {balance.low
              ? `Below the ${balance.threshold.toLocaleString()} warning level — top up before customers cannot sign in.`
              : `messages left via ${balance.provider}. Warns below ${balance.threshold.toLocaleString()}.`}
          </p>
        </>
      )}
    </Card>
  );
}
