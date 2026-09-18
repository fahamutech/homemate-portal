import {useState} from 'react';
import type {FormEvent} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import type {PaymentMethod} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {
  Button, Card, DataTable, Field, Modal, RowActions,
  Select, StatusBadge, TextArea, TextInput, humanise, fieldStyles,
} from '../../components/ui';

const KINDS = [
  {value: 'mobile_money', label: 'Mobile money'},
  {value: 'bank_transfer', label: 'Bank transfer'},
  {value: 'card', label: 'Card'},
  {value: 'cash', label: 'Cash'},
  {value: 'cheque', label: 'Cheque'},
];

/**
 * Payment configuration. A method names the PaymentPort adapter that will move
 * the money (`provider`), so the only providers offered here are the adapters
 * actually registered on the server — the API refuses anything else rather
 * than letting a broken method reach checkout.
 */
export function PaymentMethodsTab() {
  const api = useAdminApi();
  const {state, refresh} = useResource(() => api.listPaymentMethods(), 'payment-methods');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);

  const providers = state.data?.availableProviders ?? [];

  async function toggleActive(method: PaymentMethod) {
    await api.updatePaymentMethod(method.id, {isActive: !method.is_active});
    refresh();
  }

  return (
    <>
      <div className={fieldStyles.tabActions}>
        <Button onClick={() => setCreating(true)}>Add method</Button>
      </div>
      <Card>
        <DataTable<PaymentMethod>
          status={state.status}
          error={state.status === 'error' ? state.error : undefined}
          onRetry={refresh}
          rows={state.data?.items ?? []}
          emptyMessage="No payment methods configured yet."
          columns={[
            {key: 'name', header: 'Method', render: (m) => m.name},
            {key: 'code', header: 'Code', render: (m) => <code>{m.code}</code>},
            {key: 'kind', header: 'Type', render: (m) => humanise(m.kind)},
            {key: 'provider', header: 'Provider adapter', render: (m) => m.provider},
            {
              key: 'status',
              header: 'Status',
              render: (m) => <StatusBadge status={m.is_active ? 'active' : 'deactivated'} />,
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (method) => (
                <RowActions>
                  <Button variant="ghost" size="small" onClick={() => setEditing(method)}>Configure</Button>
                  <Button variant="outline" size="small" onClick={() => toggleActive(method)}>
                    {method.is_active ? 'Disable' : 'Enable'}
                  </Button>
                </RowActions>
              ),
            },
          ]}
        />
        {providers.length > 0 && (
          <p className={fieldStyles.paginationInfo} style={{marginTop: 'var(--space-lg)'}}>
            Registered provider adapters: {providers.join(', ')}
          </p>
        )}
      </Card>

      {creating && (
        <PaymentMethodModal
          providers={providers}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}

      {editing && (
        <PaymentMethodModal
          method={editing}
          providers={providers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function PaymentMethodModal({
  method,
  providers,
  onClose,
  onSaved,
}: {
  method?: PaymentMethod;
  providers: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useAdminApi();
  const [form, setForm] = useState({
    code: method?.code ?? '',
    name: method?.name ?? '',
    kind: method?.kind ?? 'mobile_money',
    provider: method?.provider ?? providers[0] ?? 'sandbox',
    instructions: method?.instructions ?? '',
    config: JSON.stringify(method?.config ?? {}, null, 2),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let config: Record<string, unknown> = {};
      if (form.config.trim()) {
        try {
          config = JSON.parse(form.config);
        } catch {
          throw new Error('Provider configuration must be valid JSON');
        }
      }

      if (method) {
        await api.updatePaymentMethod(method.id, {
          name: form.name,
          kind: form.kind,
          provider: form.provider,
          instructions: form.instructions,
          config,
        });
      } else {
        await api.createPaymentMethod({...form, config});
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this payment method');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={method ? `Configure ${method.name}` : 'Add a payment method'}
      description={method ? undefined : 'New methods start disabled until you enable them.'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className={fieldStyles.modalBody}>
        {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}

        <Field label="Name" htmlFor="pm-name">
          <TextInput id="pm-name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
        </Field>
        {!method && (
          <Field label="Code" htmlFor="pm-code">
            <TextInput
              id="pm-code"
              placeholder="halopesa"
              value={form.code}
              onChange={(e) => setForm({...form, code: e.target.value})}
              required
            />
          </Field>
        )}
        <Field label="Type" htmlFor="pm-kind">
          <Select id="pm-kind" options={KINDS} value={form.kind} onChange={(e) => setForm({...form, kind: e.target.value})} />
        </Field>
        <Field label="Provider adapter" htmlFor="pm-provider">
          <Select
            id="pm-provider"
            options={providers.map((p) => ({value: p, label: p}))}
            value={form.provider}
            onChange={(e) => setForm({...form, provider: e.target.value})}
          />
        </Field>
        <Field label="Payer instructions" htmlFor="pm-instructions">
          <TextArea
            id="pm-instructions"
            value={form.instructions}
            onChange={(e) => setForm({...form, instructions: e.target.value})}
          />
        </Field>
        <Field label="Provider configuration (JSON)" htmlFor="pm-config">
          <TextArea id="pm-config" value={form.config} onChange={(e) => setForm({...form, config: e.target.value})} />
        </Field>

        <div className={fieldStyles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  );
}
