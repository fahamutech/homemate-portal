import {describe, test, expect, vi} from 'vitest';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {AgenciesPage} from './AgenciesPage';
import {DictionariesPage} from './DictionariesPage';
import {SettingsPage} from './SettingsPage';
import {AuditPage} from './AuditPage';
import {DashboardPage} from './DashboardPage';
import {renderAdminScreen} from './testUtils';
import {createFakeAdminApi} from '../../api/adminApi.fake';
import {AdminApiError} from '../../api/adminApi';

describe('AgenciesPage', () => {
  test('lists organizations with member and listing counts', async () => {
    renderAdminScreen(<AgenciesPage />);

    expect(await screen.findByText('Masaki Realty')).toBeInTheDocument();
    expect(screen.getByText('BRELA-12345')).toBeInTheDocument();
  });

  test('a pending organization offers approve and reject, not suspend', async () => {
    renderAdminScreen(<AgenciesPage />);
    await screen.findByText('Masaki Realty');

    const row = within(screen.getByText('Masaki Realty').closest('tr')!);
    expect(row.getByRole('button', {name: /approve/i})).toBeInTheDocument();
    expect(row.getByRole('button', {name: /reject/i})).toBeInTheDocument();
    expect(row.queryByRole('button', {name: /suspend/i})).not.toBeInTheDocument();
  });

  test('approving records the decision and swaps the available actions', async () => {
    const api = createFakeAdminApi();
    const changeOrganizationStatus = vi.spyOn(api, 'changeOrganizationStatus');
    const user = userEvent.setup();
    renderAdminScreen(<AgenciesPage />, {api});
    await screen.findByText('Masaki Realty');

    await user.click(within(screen.getByText('Masaki Realty').closest('tr')!).getByRole('button', {name: /approve/i}));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', {name: /^approve$/i}));

    await waitFor(() => {
      expect(changeOrganizationStatus).toHaveBeenCalledWith('org-1', {status: 'active', reason: undefined});
    });
    await waitFor(() => {
      expect(
        within(screen.getByText('Masaki Realty').closest('tr')!).getByRole('button', {name: /suspend/i})
      ).toBeInTheDocument();
    });
  });

  test('rejecting requires a reason', async () => {
    const api = createFakeAdminApi();
    const changeOrganizationStatus = vi.spyOn(api, 'changeOrganizationStatus');
    const user = userEvent.setup();
    renderAdminScreen(<AgenciesPage />, {api});
    await screen.findByText('Masaki Realty');

    await user.click(within(screen.getByText('Masaki Realty').closest('tr')!).getByRole('button', {name: /reject/i}));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', {name: /^reject$/i}));
    expect(await screen.findByText(/a reason is required/i)).toBeInTheDocument();
    expect(changeOrganizationStatus).not.toHaveBeenCalled();

    await user.type(dialog.getByLabelText(/rejection reason/i), 'Unverifiable registration');
    await user.click(dialog.getByRole('button', {name: /^reject$/i}));

    await waitFor(() => {
      expect(changeOrganizationStatus).toHaveBeenCalledWith('org-1', {
        status: 'rejected',
        reason: 'Unverifiable registration',
      });
    });
  });

  test('registers a new organization', async () => {
    const api = createFakeAdminApi();
    const createOrganization = vi.spyOn(api, 'createOrganization');
    const user = userEvent.setup();
    renderAdminScreen(<AgenciesPage />, {api});
    await screen.findByText('Masaki Realty');

    await user.click(screen.getByRole('button', {name: /register organization/i}));
    const form = within(await screen.findByRole('dialog'));
    await user.type(form.getByLabelText(/^name$/i), 'Kigamboni Homes');
    await user.click(form.getByRole('button', {name: /^register$/i}));

    await waitFor(() => {
      expect(createOrganization).toHaveBeenCalledWith(expect.objectContaining({name: 'Kigamboni Homes'}));
    });
    expect(await screen.findByText('Kigamboni Homes')).toBeInTheDocument();
  });
});

describe('DictionariesPage', () => {
  test('shows items for the selected category and switches categories', async () => {
    const api = createFakeAdminApi();
    const searchDictionary = vi.spyOn(api, 'searchDictionary');
    const user = userEvent.setup();
    renderAdminScreen(<DictionariesPage />, {api});

    expect(await screen.findByText('Dar es Salaam')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/category/i), 'property_type');

    await waitFor(() => {
      expect(searchDictionary).toHaveBeenLastCalledWith(
        expect.objectContaining({category: 'property_type'})
      );
    });
    expect(await screen.findByText('Apartment')).toBeInTheDocument();
  });

  test('archiving an item hides it from the active list, and it can be restored', async () => {
    const api = createFakeAdminApi();
    const archiveDictionaryItem = vi.spyOn(api, 'archiveDictionaryItem');
    const user = userEvent.setup();
    renderAdminScreen(<DictionariesPage />, {api});
    await screen.findByText('Dar es Salaam');

    await user.click(within(screen.getByText('Dar es Salaam').closest('tr')!).getByRole('button', {name: /archive/i}));

    await waitFor(() => {
      expect(archiveDictionaryItem).toHaveBeenCalledWith('dict-region-1');
    });
    expect(await screen.findByText(/no items in this category yet/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/show inactive/i), 'true');
    const row = within((await screen.findByText('Dar es Salaam')).closest('tr')!);
    await user.click(row.getByRole('button', {name: /restore/i}));

    await user.selectOptions(screen.getByLabelText(/show inactive/i), 'false');
    expect(await screen.findByText('Dar es Salaam')).toBeInTheDocument();
  });

  test('searching master data looks across every category', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<DictionariesPage />);
    await screen.findByText('Dar es Salaam');

    // "Apartment" is a property type while the page is browsing regions, so
    // finding it proves the search is not scoped to the open category.
    await user.type(screen.getByLabelText(/search this page/i), 'Apartment');

    expect(await screen.findByText('Apartment')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Dar es Salaam')).not.toBeInTheDocument();
    });
  });

  test('a sheet is imported, and re-importing it corrects rather than duplicates', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<DictionariesPage />);
    await screen.findByText('Dar es Salaam');

    await user.click(screen.getByRole('button', {name: /^import$/i}));
    let form = within(await screen.findByRole('dialog'));
    await user.clear(form.getByLabelText(/paste the rows/i));
    await user.type(
      form.getByLabelText(/paste the rows/i),
      'code,name,parentCode{enter}test_mbeya,Mbeya,{enter}test_mbeya_city,Mbeya Cty,test_mbeya'
    );
    await user.click(form.getByRole('button', {name: /^import$/i}));

    expect(await screen.findByRole('status')).toHaveTextContent(/2 created, 0 updated/i);

    // Re-import with the typo fixed: same codes, so nothing is duplicated.
    await user.clear(form.getByLabelText(/paste the rows/i));
    await user.type(
      form.getByLabelText(/paste the rows/i),
      'code,name,parentCode{enter}test_mbeya_city,Mbeya City,test_mbeya'
    );
    await user.click(form.getByRole('button', {name: /^import$/i}));

    expect(await screen.findByRole('status')).toHaveTextContent(/0 created, 1 updated/i);

    await user.click(form.getByRole('button', {name: /close/i}));
    await user.type(screen.getByLabelText(/search this page/i), 'Mbeya City');
    expect(await screen.findByText('Mbeya City')).toBeInTheDocument();
    expect(screen.queryByText('Mbeya Cty')).not.toBeInTheDocument();
  });

  test('an import naming an unknown parent is refused whole', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<DictionariesPage />);
    await screen.findByText('Dar es Salaam');

    await user.click(screen.getByRole('button', {name: /^import$/i}));
    const form = within(await screen.findByRole('dialog'));
    await user.clear(form.getByLabelText(/paste the rows/i));
    await user.type(
      form.getByLabelText(/paste the rows/i),
      'code,name,parentCode{enter}test_good,Good,{enter}test_orphan,Orphan,test_nowhere'
    );
    await user.click(form.getByRole('button', {name: /^import$/i}));

    expect(await screen.findByRole('alert')).toHaveTextContent(/is not in this category/i);

    // Nothing from the sheet landed, not even the row before the bad one.
    await user.click(form.getByRole('button', {name: /close/i}));
    await user.type(screen.getByLabelText(/search this page/i), 'test_good');
    expect(await screen.findByText(/nothing matches that search/i)).toBeInTheDocument();
  });

  test('an item other rows depend on cannot be deleted', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<DictionariesPage />);
    await screen.findByText('Dar es Salaam');

    // dict-region-1 has a child in the fixture, so delete is not offered.
    const parentRow = within(screen.getByText('Dar es Salaam').closest('tr')!);
    expect(parentRow.queryByRole('button', {name: /delete/i})).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/category/i), 'property_type');
    const leafRow = within((await screen.findByText('Apartment')).closest('tr')!);
    expect(leafRow.getByRole('button', {name: /delete/i})).toBeInTheDocument();
  });

  test('creating a duplicate code surfaces the conflict from the server', async () => {
    const api = createFakeAdminApi();
    const user = userEvent.setup();
    renderAdminScreen(<DictionariesPage />, {api});
    await screen.findByText('Dar es Salaam');

    await user.click(screen.getByRole('button', {name: /add item/i}));
    const form = within(await screen.findByRole('dialog'));
    await user.type(form.getByLabelText(/^name$/i), 'Duplicate');
    await user.type(form.getByLabelText(/^code$/i), 'dar_es_salaam');
    await user.click(form.getByRole('button', {name: /add item/i}));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i);
  });
});

describe('SettingsPage', () => {
  test('groups settings by category and shows current values', async () => {
    renderAdminScreen(<SettingsPage />);

    expect(await screen.findByText('Display name')).toBeInTheDocument();
    expect(screen.getByText('HomeMate Africa')).toBeInTheDocument();
    expect(screen.getByText('Commission')).toBeInTheDocument();
  });

  test('edits a numeric setting through the API', async () => {
    const api = createFakeAdminApi();
    const updateSetting = vi.spyOn(api, 'updateSetting');
    const user = userEvent.setup();
    renderAdminScreen(<SettingsPage />, {api});
    await screen.findByText('Broker commission %');

    await user.click(within(screen.getByText('Broker commission %').closest('tr')!).getByRole('button', {name: /edit/i}));
    const form = within(await screen.findByRole('dialog'));
    const input = form.getByLabelText(/value/i);
    await user.clear(input);
    await user.type(input, '7.5');
    await user.click(form.getByRole('button', {name: /^save$/i}));

    await waitFor(() => {
      expect(updateSetting).toHaveBeenCalledWith('commission.broker_percentage', 7.5);
    });
  });

  test('refuses to save an emptied numeric setting (a number input discards "abc", leaving it blank)', async () => {
    const api = createFakeAdminApi();
    const updateSetting = vi.spyOn(api, 'updateSetting');
    const user = userEvent.setup();
    renderAdminScreen(<SettingsPage />, {api});
    await screen.findByText('Broker commission %');

    await user.click(within(screen.getByText('Broker commission %').closest('tr')!).getByRole('button', {name: /edit/i}));
    const form = within(await screen.findByRole('dialog'));
    const input = form.getByLabelText(/value/i);
    await user.clear(input);
    await user.type(input, 'abc');
    await user.click(form.getByRole('button', {name: /^save$/i}));

    expect(await screen.findByRole('alert')).toHaveTextContent(/expects a number/i);
    expect(updateSetting).not.toHaveBeenCalled();
  });

  test('shows version history for a setting', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<SettingsPage />);
    await screen.findByText('Broker commission %');

    await user.click(within(screen.getByText('Broker commission %').closest('tr')!).getByRole('button', {name: /history/i}));

    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByText('admin@homemate.co.tz')).toBeInTheDocument();
  });
});

describe('AuditPage', () => {
  test('lists audit entries and filters by record type', async () => {
    const api = createFakeAdminApi();
    const auditLog = vi.spyOn(api, 'auditLog');
    const user = userEvent.setup();
    renderAdminScreen(<AuditPage />, {api});

    expect(await screen.findByText('Masaki 3BR Apartment')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/record type/i), 'users');

    await waitFor(() => {
      expect(auditLog).toHaveBeenLastCalledWith(expect.objectContaining({tableName: 'users'}));
    });
    expect(await screen.findByText(/no audit entries match these filters/i)).toBeInTheDocument();
  });
});

describe('DashboardPage', () => {
  test('renders KPI values from the API, not hardcoded numbers', async () => {
    renderAdminScreen(<DashboardPage />);

    const usersCard = await screen.findByRole('button', {name: /total platform users/i});
    // fake has 2 platform users + 1 staff member
    expect(within(usersCard).getByText('2')).toBeInTheDocument();

    const pending = screen.getByRole('button', {name: /pending approvals/i});
    // 1 pending property + 1 pending organization
    expect(within(pending).getByText('2')).toBeInTheDocument();
  });

  test('shows recent audit activity', async () => {
    renderAdminScreen(<DashboardPage />);
    expect(await screen.findByText('Masaki 3BR Apartment')).toBeInTheDocument();
    expect(screen.getByText(/1 listings waiting approval/i)).toBeInTheDocument();
  });

  test('shows an error state when the dashboard cannot load', async () => {
    const api = createFakeAdminApi({
      dashboard: vi.fn().mockRejectedValue(new AdminApiError('INTERNAL_ERROR', 'Database unavailable', 500)),
    });
    renderAdminScreen(<DashboardPage />, {api});

    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
  });
});
