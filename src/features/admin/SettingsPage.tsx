import {useState} from 'react';
import type {FormEvent} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import type {PlatformSetting} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {
  Button, Card, DataTable, Field, Modal, PageSection, RowActions, TextInput, humanise, fieldStyles,
} from '../../components/ui';

function displayValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Platform settings. Every change is versioned by a database trigger, so the
 * history panel is a read of real data rather than something the UI has to
 * maintain.
 */
export function SettingsPage() {
  const api = useAdminApi();
  const {state, refresh} = useResource(() => api.listSettings(), 'settings');
  const [editing, setEditing] = useState<PlatformSetting | null>(null);
  const [historyKey, setHistoryKey] = useState<string | null>(null);

  const grouped = state.data?.grouped ?? {};
  const byKey = new Map((state.data?.items ?? []).map((setting) => [setting.key, setting]));
  const tenantFee = byKey.get('commission.tenant_fee_percentage');
  const platformShare = byKey.get('commission.platform_percentage');

  return (
    <PageSection title="Platform settings" description="Commission rates, listing rules and operational configuration.">
      {state.status === 'error' && (
        <div className={fieldStyles.errorBlock} role="alert">{state.error}</div>
      )}

      {tenantFee && platformShare && (
        <TenantFeeCard
          tenantFeePercentage={Number(tenantFee.value)}
          platformPercentage={Number(platformShare.value)}
          onEdit={(key) => setEditing(byKey.get(key) ?? null)}
        />
      )}

      {Object.entries(grouped).map(([category, settings]) => (
        <Card key={category}>
          <h3 style={{margin: '0 0 var(--space-xl) 0', fontSize: 14, color: 'var(--color-text-primary)'}}>
            {humanise(category)}
          </h3>
          <DataTable<PlatformSetting & {id: string}>
            status={state.status}
            rows={settings.map((setting) => ({...setting, id: setting.key}))}
            columns={[
              {key: 'key', header: 'Setting', render: (setting) => setting.description ?? setting.key},
              {key: 'rawKey', header: 'Key', render: (setting) => <code>{setting.key}</code>},
              {key: 'value', header: 'Value', render: (setting) => displayValue(setting.value)},
              {key: 'updatedBy', header: 'Updated by', render: (setting) => setting.updated_by ?? '—'},
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (setting) => (
                  <RowActions>
                    <Button variant="ghost" size="small" onClick={() => setHistoryKey(setting.key)}>History</Button>
                    <Button variant="outline" size="small" onClick={() => setEditing(setting)}>Edit</Button>
                  </RowActions>
                ),
              },
            ]}
          />
        </Card>
      ))}

      {editing && (
        <EditSettingModal
          setting={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      {historyKey && <SettingHistoryModal settingKey={historyKey} onClose={() => setHistoryKey(null)} />}
    </PageSection>
  );
}

const EXAMPLE_RENT = 1_000_000;

function tzs(value: number) {
  return `TZS ${Math.round(value).toLocaleString()}`;
}

/**
 * What the two commission settings mean, in shillings, for a typical home.
 *
 * The customer pays a share of one month's rent as the tenant fee instead of
 * the usual month's agent fee, and sees the difference as a saving. HomeMate
 * keeps a share *of the fee*; the listing agent — or the landlord, if they
 * listed it themselves — gets the rest. Rent and deposits are never touched.
 */
function TenantFeeCard({
  tenantFeePercentage,
  platformPercentage,
  onEdit,
}: {
  tenantFeePercentage: number;
  platformPercentage: number;
  onEdit: (key: string) => void;
}) {
  const fee = (EXAMPLE_RENT * tenantFeePercentage) / 100;
  const saving = Math.max(EXAMPLE_RENT - fee, 0);
  const platform = (fee * platformPercentage) / 100;
  const agent = fee - platform;

  return (
    <Card>
      <h3 style={{margin: '0 0 var(--space-sm) 0', fontSize: 14, color: 'var(--color-text-primary)'}}>
        The tenant fee and HomeMate’s commission
      </h3>
      <p style={{margin: '0 0 var(--space-lg) 0', fontSize: 13, color: 'var(--color-text-secondary)'}}>
        Charged once, in the customer’s first payment. HomeMate earns nothing from rent or deposits —
        only its share of this fee. A change applies to new checkouts; a reservation already under way
        keeps the fee its customer was shown.
      </p>
      <DataTable<{id: string; label: string; value: string; note: string}>
        status="ready"
        rows={[
          {
            id: 'fee',
            label: `Customer pays ${tenantFeePercentage}% of one month’s rent`,
            value: tzs(fee),
            note: `Saves ${tzs(saving)} against the usual one-month agent fee`,
          },
          {
            id: 'platform',
            label: `HomeMate keeps ${platformPercentage}% of the fee`,
            value: tzs(platform),
            note: 'Listing commission',
          },
          {
            id: 'agent',
            label: 'The listing agent receives the rest of the fee',
            value: tzs(agent),
            note: 'The landlord receives it when they listed the home themselves',
          },
        ]}
        columns={[
          {key: 'label', header: `On a rent of ${tzs(EXAMPLE_RENT)} a month`, render: (row) => row.label},
          {key: 'value', header: 'Amount', render: (row) => <strong>{row.value}</strong>},
          {key: 'note', header: '', render: (row) => row.note},
        ]}
      />
      <RowActions>
        <Button variant="outline" size="small" onClick={() => onEdit('commission.tenant_fee_percentage')}>
          Change the tenant fee
        </Button>
        <Button variant="outline" size="small" onClick={() => onEdit('commission.platform_percentage')}>
          Change HomeMate’s share
        </Button>
      </RowActions>
    </Card>
  );
}

function EditSettingModal({
  setting,
  onClose,
  onSaved,
}: {
  setting: PlatformSetting;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useAdminApi();
  const isBoolean = typeof setting.value === 'boolean';
  const isPercentage = setting.key.startsWith('commission.') && setting.key.endsWith('percentage');
  const isNumber = typeof setting.value === 'number' || isPercentage;
  const [value, setValue] = useState(String(setting.value ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // An empty numeric field must not fall through as 0 — a number input
      // silently discards non-numeric keystrokes, so "abc" arrives here as ''.
      const parsed = isBoolean
        ? value === 'true'
        : isNumber
          ? (value.trim() === '' ? Number.NaN : Number(value))
          : value;
      if (isNumber && Number.isNaN(parsed as number)) {
        throw new Error('This setting expects a number');
      }
      if (isPercentage && ((parsed as number) < 0 || (parsed as number) > 100)) {
        throw new Error('This is a percentage, so it must be from 0 to 100');
      }
      await api.updateSetting(setting.key, parsed);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this setting');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={setting.description ?? setting.key} description={setting.key} onClose={onClose}>
      <form onSubmit={handleSubmit} className={fieldStyles.modalBody}>
        {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}
        <Field label={isPercentage ? 'Percentage (0–100)' : 'Value'} htmlFor="setting-value">
          {isBoolean ? (
            <select
              id="setting-value"
              className={fieldStyles.select}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : (
            <TextInput
              id="setting-value"
              type={isNumber ? 'number' : 'text'}
              step="any"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
        </Field>
        <div className={fieldStyles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SettingHistoryModal({settingKey, onClose}: {settingKey: string; onClose: () => void}) {
  const api = useAdminApi();
  const {state} = useResource(() => api.settingHistory(settingKey), `history-${settingKey}`);

  return (
    <Modal
      title="Change history"
      description={settingKey}
      onClose={onClose}
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      {state.status === 'loading' && <p className={fieldStyles.stateBlock}>Loading…</p>}
      {state.status === 'error' && <div className={fieldStyles.errorBlock} role="alert">{state.error}</div>}
      {state.data && state.data.items.length === 0 && (
        <p className={fieldStyles.stateBlock}>This setting has never been changed.</p>
      )}
      {state.data && state.data.items.length > 0 && (
        <table className={fieldStyles.table}>
          <thead>
            <tr><th>When</th><th>From</th><th>To</th><th>By</th></tr>
          </thead>
          <tbody>
            {state.data.items.map((entry, index) => (
              <tr key={index}>
                <td data-label="When">{new Date(entry.changed_at).toLocaleString()}</td>
                <td data-label="From">{displayValue(entry.old_value)}</td>
                <td data-label="To">{displayValue(entry.new_value)}</td>
                <td data-label="By">{entry.changed_by ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
