import {useState} from 'react';
import type {FormEvent} from 'react';
import {useAdminApi} from '../../api/AdminApiContext';
import type {DictionaryItem} from '../../api/adminApi';
import {useResource} from '../../hooks/useResource';
import {
  Button, Card, ConfirmDialog, DataTable, Field, FilterBar, Modal, PageSection,
  RowActions, Select, StatusBadge, TextArea, TextInput, humanise, fieldStyles,
} from '../../components/ui';
import {useAdminSearch} from './searchContext';

const HIERARCHY_PARENT: Record<string, string> = {district: 'region', ward: 'district'};

/**
 * Master data / dictionaries: regions → districts → wards plus the flat lists
 * (property types, amenities, currencies, rejection reasons). The parent
 * picker only appears for hierarchical categories because the database
 * refuses a ward without a district, and vice versa.
 */
export function DictionariesPage() {
  const api = useAdminApi();
  const [category, setCategory] = useState('region');
  const [parentId, setParentId] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DictionaryItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<DictionaryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Searching master data is not category-scoped: an operator looking for
  // "Kinondoni" should not have to know first whether it is a district.
  const searchTerm = useAdminSearch('Name or code, across every category');

  const categories = useResource(() => api.dictionaryCategories(), 'dictionary-categories');
  const parentCategory = HIERARCHY_PARENT[category];

  const parents = useResource(
    () => (parentCategory ? api.listDictionary(parentCategory) : Promise.resolve({items: []})),
    `parents-${parentCategory ?? 'none'}`
  );

  const items = useResource(
    () =>
      api.searchDictionary({
        query: searchTerm || undefined,
        // a search spans categories; browsing stays inside the chosen one
        category: searchTerm ? undefined : category,
        parentId: searchTerm ? undefined : parentId || undefined,
        includeInactive,
        limit: 100,
      }),
    `${category}-${parentId}-${includeInactive}-${searchTerm}`
  );

  function reload() {
    setError(null);
    items.refresh();
    categories.refresh();
  }

  async function run(work: Promise<unknown>) {
    try {
      await work;
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That change could not be saved');
    }
  }

  return (
    <PageSection
      title="Dictionaries & master data"
      description="Geography, property types, amenities and other reference lists used across the platform."
      actions={
        <>
          <Button variant="outline" onClick={() => setImporting(true)}>Import</Button>
          <Button onClick={() => setCreating(true)}>Add item</Button>
        </>
      }
    >
      {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}
      <Card>
        <FilterBar>
          <Field label="Category" htmlFor="dict-category">
            <Select
              id="dict-category"
              options={(categories.state.data?.items ?? []).map((c) => ({
                value: c.category,
                label: `${humanise(c.category)} (${c.active_count}/${c.item_count})`,
              }))}
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setParentId('');
              }}
            />
          </Field>
          {parentCategory && (
            <Field label={humanise(parentCategory)} htmlFor="dict-parent">
              <Select
                id="dict-parent"
                placeholder={`All ${parentCategory}s`}
                options={(parents.state.data?.items ?? []).map((p) => ({value: p.id, label: p.name}))}
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              />
            </Field>
          )}
          <Field label="Show inactive" htmlFor="dict-inactive">
            <Select
              id="dict-inactive"
              options={[{value: 'false', label: 'Active only'}, {value: 'true', label: 'Include inactive'}]}
              value={String(includeInactive)}
              onChange={(event) => setIncludeInactive(event.target.value === 'true')}
            />
          </Field>
        </FilterBar>
      </Card>

      <Card>
        <DataTable<DictionaryItem>
          status={items.state.status}
          error={items.state.status === 'error' ? items.state.error : undefined}
          onRetry={items.refresh}
          rows={items.state.data?.items ?? []}
          emptyMessage={searchTerm ? 'Nothing matches that search.' : 'No items in this category yet.'}
          columns={[
            {key: 'name', header: 'Name', render: (item) => item.name},
            {key: 'code', header: 'Code', render: (item) => item.code},
            ...(searchTerm
              ? [{
                  key: 'category',
                  header: 'Category',
                  render: (item: DictionaryItem) => humanise(item.category),
                }]
              : []),
            {key: 'parent', header: 'Parent', render: (item) => item.parent_name ?? '—'},
            {key: 'children', header: 'Children', render: (item) => String(item.child_count ?? 0)},
            {key: 'order', header: 'Order', render: (item) => String(item.sort_order)},
            {
              key: 'status',
              header: 'Status',
              render: (item) => <StatusBadge status={item.is_active ? 'active' : 'deactivated'} />,
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (item) => (
                <RowActions>
                  <Button variant="ghost" size="small" onClick={() => setEditing(item)}>Edit</Button>
                  {item.is_active ? (
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => run(api.archiveDictionaryItem(item.id))}
                    >
                      Archive
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => run(api.restoreDictionaryItem(item.id))}
                    >
                      Restore
                    </Button>
                  )}
                  {/* Deleting is offered only where it can succeed; anything
                      already referenced is archived instead, and the server
                      refuses it either way. */}
                  {!item.in_use && (
                    <Button variant="ghost" size="small" onClick={() => setDeleting(item)}>
                      Delete
                    </Button>
                  )}
                </RowActions>
              ),
            },
          ]}
        />
      </Card>

      {(creating || editing) && (
        <DictionaryItemModal
          key={editing?.id ?? 'new'}
          item={editing ?? undefined}
          category={editing?.category ?? category}
          parentCategory={HIERARCHY_PARENT[editing?.category ?? category]}
          parents={parents.state.data?.items ?? []}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            reload();
          }}
        />
      )}

      {importing && (
        <ImportDictionaryModal
          category={category}
          onClose={() => setImporting(false)}
          onImported={reload}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          description="This removes the item permanently. Anything already using it would be archived instead."
          confirmLabel="Delete"
          destructive
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await api.deleteDictionaryItem(deleting.id);
            setDeleting(null);
            reload();
          }}
        />
      )}
    </PageSection>
  );
}

/** Create and edit share one form: the fields are the same either way. */
function DictionaryItemModal({
  item,
  category,
  parentCategory,
  parents,
  onClose,
  onSaved,
}: {
  item?: DictionaryItem;
  category: string;
  parentCategory?: string;
  parents: DictionaryItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useAdminApi();
  const [form, setForm] = useState({
    code: item?.code ?? '',
    name: item?.name ?? '',
    parentId: item?.parent_id ?? '',
    sortOrder: String(item?.sort_order ?? 0),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        code: form.code,
        name: form.name,
        parentId: form.parentId || undefined,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (item) await api.updateDictionaryItem(item.id, body);
      else await api.createDictionaryItem({category, ...body});
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this item');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={item ? `Edit ${item.name}` : `Add a ${humanise(category).toLowerCase()}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className={fieldStyles.modalBody}>
        {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}
        <Field label="Name" htmlFor="dict-name">
          <TextInput id="dict-name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
        </Field>
        <Field label="Code" htmlFor="dict-code">
          <TextInput
            id="dict-code"
            placeholder="lowercase_with_underscores"
            value={form.code}
            onChange={(e) => setForm({...form, code: e.target.value})}
            required
          />
        </Field>
        {parentCategory && (
          <Field label={humanise(parentCategory)} htmlFor="dict-new-parent">
            <Select
              id="dict-new-parent"
              placeholder={`Select a ${parentCategory}`}
              options={parents.map((p) => ({value: p.id, label: p.name}))}
              value={form.parentId}
              onChange={(e) => setForm({...form, parentId: e.target.value})}
              required
            />
          </Field>
        )}
        <Field label="Sort order" htmlFor="dict-order">
          <TextInput
            id="dict-order"
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({...form, sortOrder: e.target.value})}
          />
        </Field>
        <div className={fieldStyles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : item ? 'Save changes' : 'Add item'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Bulk import. Master data arrives as spreadsheets — the wards of a new
 * region, a revised amenity list — and typing them one at a time is how they
 * end up inconsistent. CSV is what people actually have, so that is what this
 * takes; a `parentCode` column lets a regions/districts/wards sheet carry its
 * own hierarchy without anyone pasting uuids.
 *
 * Nothing is sent until the whole sheet parses, and the server applies it in
 * one transaction, so a bad row leaves the category untouched.
 */
function ImportDictionaryModal({
  category,
  onClose,
  onImported,
}: {
  category: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const api = useAdminApi();
  const [text, setText] = useState('code,name,parentCode,sortOrder\n');
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{created: number; updated: number; deactivated: number} | null>(null);

  async function handleFile(files: FileList | null) {
    if (!files?.length) return;
    setText(await files[0].text());
    setResult(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const items = parseCsv(text);
      if (!items.length) throw new Error('That sheet has no rows');
      setResult(await api.importDictionary({category, items, deactivateMissing}));
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That sheet could not be imported');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Import ${humanise(category).toLowerCase()} items`}
      description="Rows with a code that already exists are updated, so a corrected sheet can be re-imported safely."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className={fieldStyles.modalBody}>
        {error && <div className={fieldStyles.errorBlock} role="alert">{error}</div>}
        {result && (
          <p role="status">
            Imported: {result.created} created, {result.updated} updated
            {result.deactivated > 0 && `, ${result.deactivated} archived`}.
          </p>
        )}
        <Field label="CSV file" htmlFor="dict-import-file">
          <input
            id="dict-import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => handleFile(event.target.files)}
          />
        </Field>
        <Field label="Or paste the rows" htmlFor="dict-import-text">
          <TextArea
            id="dict-import-text"
            rows={8}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </Field>
        <Field label="Codes missing from this sheet" htmlFor="dict-import-missing">
          <Select
            id="dict-import-missing"
            options={[
              {value: 'false', label: 'Leave them as they are'},
              {value: 'true', label: 'Archive them'},
            ]}
            value={String(deactivateMissing)}
            onChange={(event) => setDeactivateMissing(event.target.value === 'true')}
          />
        </Field>
        <div className={fieldStyles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Close</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Importing…' : 'Import'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * A deliberately small CSV reader: a header row naming the columns, then
 * values, with double quotes around anything containing a comma. Master data
 * is short text — names and codes — so a full CSV library would be weight
 * without a purpose, and the server validates every row regardless.
 */
export function parseCsv(input: string): Record<string, string>[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return [];

  const headers = splitRow(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = splitRow(line);
    return Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? '').trim()]));
  });
}

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      // a doubled quote inside a quoted cell is a literal quote
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}
