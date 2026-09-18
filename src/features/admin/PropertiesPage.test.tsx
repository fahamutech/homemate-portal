import {describe, test, expect, vi} from 'vitest';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {PropertiesPage} from './PropertiesPage';
import {renderAdminScreen} from './testUtils';
import {createFakeAdminApi, FAKE_PROPERTIES} from '../../api/adminApi.fake';
import {AdminApiError} from '../../api/adminApi';

function rowFor(title: string) {
  return screen.getByText(title).closest('tr')!;
}

describe('PropertiesPage', () => {
  test('lists properties with their reference code and status', async () => {
    renderAdminScreen(<PropertiesPage />);

    expect(await screen.findByText('Masaki 3BR Apartment')).toBeInTheDocument();
    expect(screen.getByText('HM-P-000001')).toBeInTheDocument();
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
  });

  test('offers only the moderation actions legal for the current status', async () => {
    renderAdminScreen(<PropertiesPage />);
    await screen.findByText('Masaki 3BR Apartment');

    // pending_review -> approve / request changes / reject
    const row = within(rowFor('Masaki 3BR Apartment'));
    expect(row.getByRole('button', {name: /approve/i})).toBeInTheDocument();
    expect(row.getByRole('button', {name: /request changes/i})).toBeInTheDocument();
    expect(row.getByRole('button', {name: /reject/i})).toBeInTheDocument();
    expect(row.queryByRole('button', {name: /^restore$/i})).not.toBeInTheDocument();
    expect(row.queryByRole('button', {name: /submit for review/i})).not.toBeInTheDocument();
  });

  test('approving a listing calls the API and refreshes', async () => {
    const api = createFakeAdminApi();
    const changePropertyStatus = vi.spyOn(api, 'changePropertyStatus');
    const user = userEvent.setup();
    renderAdminScreen(<PropertiesPage />, {api});
    await screen.findByText('Masaki 3BR Apartment');

    await user.click(within(rowFor('Masaki 3BR Apartment')).getByRole('button', {name: /approve/i}));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', {name: /^approve$/i}));

    await waitFor(() => {
      expect(changePropertyStatus).toHaveBeenCalledWith('prop-1', {status: 'approved', reason: undefined});
    });
    // the row's own badge, not the "Approved" option in the status filter
    await waitFor(() => {
      expect(within(rowFor('Masaki 3BR Apartment')).getByText('Approved')).toBeInTheDocument();
    });
  });

  test('rejecting requires a reason', async () => {
    const api = createFakeAdminApi();
    const changePropertyStatus = vi.spyOn(api, 'changePropertyStatus');
    const user = userEvent.setup();
    renderAdminScreen(<PropertiesPage />, {api});
    await screen.findByText('Masaki 3BR Apartment');

    await user.click(within(rowFor('Masaki 3BR Apartment')).getByRole('button', {name: /reject/i}));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', {name: /^reject$/i}));

    expect(await screen.findByText(/a reason is required/i)).toBeInTheDocument();
    expect(changePropertyStatus).not.toHaveBeenCalled();

    await user.type(dialog.getByLabelText(/rejection reason/i), 'Photos unclear');
    await user.click(dialog.getByRole('button', {name: /^reject$/i}));

    await waitFor(() => {
      expect(changePropertyStatus).toHaveBeenCalledWith('prop-1', {status: 'rejected', reason: 'Photos unclear'});
    });
  });

  test('surfaces a server-refused transition instead of pretending it worked', async () => {
    const api = createFakeAdminApi({
      changePropertyStatus: vi.fn().mockRejectedValue(
        new AdminApiError('ILLEGAL_TRANSITION', 'Illegal property status transition: draft -> approved', 422)
      ),
    });
    const user = userEvent.setup();
    renderAdminScreen(<PropertiesPage />, {api});
    await screen.findByText('Masaki 3BR Apartment');

    await user.click(within(rowFor('Masaki 3BR Apartment')).getByRole('button', {name: /approve/i}));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', {name: /^approve$/i}));

    expect(await screen.findByRole('alert')).toHaveTextContent(/illegal property status transition/i);
  });

  test('filters by status through the API', async () => {
    const api = createFakeAdminApi();
    const listProperties = vi.spyOn(api, 'listProperties');
    const user = userEvent.setup();
    renderAdminScreen(<PropertiesPage />, {api});
    await screen.findByText('Masaki 3BR Apartment');

    await user.selectOptions(screen.getByLabelText(/^status$/i), 'approved');

    await waitFor(() => {
      expect(listProperties).toHaveBeenLastCalledWith(expect.objectContaining({status: 'approved'}));
    });
    expect(await screen.findByText(/no properties match these filters/i)).toBeInTheDocument();
  });

  test('applies a PostGIS radius filter and can clear it', async () => {
    const api = createFakeAdminApi();
    const listProperties = vi.spyOn(api, 'listProperties');
    const user = userEvent.setup();
    renderAdminScreen(<PropertiesPage />, {api});
    await screen.findByText('Masaki 3BR Apartment');

    await user.click(screen.getByRole('button', {name: /search by location/i}));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/latitude/i), '-6.7460');
    await user.type(dialog.getByLabelText(/longitude/i), '39.2803');
    await user.click(dialog.getByRole('button', {name: /apply/i}));

    await waitFor(() => {
      expect(listProperties).toHaveBeenLastCalledWith(
        expect.objectContaining({latitude: '-6.7460', longitude: '39.2803', radiusMetres: '5000'})
      );
    });
    expect(screen.getByText(/showing listings within/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: /clear/i}));
    await waitFor(() => {
      expect(listProperties).toHaveBeenLastCalledWith(expect.objectContaining({latitude: '', longitude: ''}));
    });
  });

  test('the detail view shows overview, money and people on separate tabs', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PropertiesPage />);
    await screen.findByText('Masaki 3BR Apartment');

    await user.click(within(rowFor('Masaki 3BR Apartment')).getByRole('button', {name: /view/i}));
    const dialog = within(await screen.findByRole('dialog'));

    // Overview: the physical facts
    expect(await dialog.findByText('-6.746, 39.2803')).toBeInTheDocument();
    expect(dialog.getByText('Semi Furnished')).toBeInTheDocument();

    // Terms & money: derived amounts come from the server, not the browser
    await user.click(dialog.getByRole('button', {name: /terms & money/i}));
    expect(dialog.getByText('TZS 4,500,000')).toBeInTheDocument();   // per instalment
    expect(dialog.getByText('TZS 1,640,000')).toBeInTheDocument();   // total monthly cost
    expect(dialog.getByTestId('payment-mode')).toHaveTextContent('Quarterly');
    expect(dialog.getByText('No loud music after 10pm.')).toBeInTheDocument();

    // People: attribution
    await user.click(dialog.getByRole('button', {name: /^people$/i}));
    expect(dialog.getByText('Amina Hassan')).toBeInTheDocument();
  });

  test('paginates when there are more rows than one page', async () => {
    const many = Array.from({length: 25}, (_, index) => ({
      ...FAKE_PROPERTIES[0],
      id: `prop-${index}`,
      reference_code: `HM-P-${String(index).padStart(6, '0')}`,
      title: `Listing ${index}`,
    }));
    const api = createFakeAdminApi({
      listProperties: async (params = {}) => {
        const limit = Number(params.limit ?? 20);
        const offset = Number(params.offset ?? 0);
        const slice = many.slice(offset, offset + limit);
        return {
          items: slice,
          pagination: {total: many.length, limit, offset, hasMore: offset + slice.length < many.length},
        };
      },
    });
    const user = userEvent.setup();
    renderAdminScreen(<PropertiesPage />, {api});

    expect(await screen.findByText('Listing 0')).toBeInTheDocument();
    expect(screen.getByText(/showing 1–20 of 25/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: /next/i}));

    expect(await screen.findByText('Listing 20')).toBeInTheDocument();
    expect(screen.getByText(/showing 21–25 of 25/i)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /next/i})).toBeDisabled();
  });

  test('a listing can be edited, seeded from what is already recorded', async () => {
    const api = createFakeAdminApi();
    const updateProperty = vi.spyOn(api, 'updateProperty');
    const user = userEvent.setup();
    renderAdminScreen(<PropertiesPage />, {api});

    await user.click(
      within((await screen.findByText('Masaki 3BR Apartment')).closest('tr')!)
        .getByRole('button', {name: /edit/i})
    );

    const dialog = within(await screen.findByRole('dialog'));
    // The form opens on the listing as it stands, not empty.
    await waitFor(() => {
      expect(dialog.getByLabelText(/^title$/i)).toHaveValue('Masaki 3BR Apartment');
    });
    expect(dialog.getByText(/edit HM-P-000001/i)).toBeInTheDocument();

    await user.clear(dialog.getByLabelText(/^title$/i));
    await user.type(dialog.getByLabelText(/^title$/i), 'Masaki 3BR Apartment (renovated)');
    await user.click(dialog.getByRole('button', {name: /save changes/i}));

    await waitFor(() => {
      expect(updateProperty).toHaveBeenCalledWith(
        'prop-1',
        expect.objectContaining({title: 'Masaki 3BR Apartment (renovated)'})
      );
    });
    expect(await screen.findByText('Masaki 3BR Apartment (renovated)')).toBeInTheDocument();
  });

  test('editing sends the amenity list even when it was emptied', async () => {
    const api = createFakeAdminApi();
    const setPropertyAmenities = vi.spyOn(api, 'setPropertyAmenities');
    const user = userEvent.setup();
    renderAdminScreen(<PropertiesPage />, {api});

    await user.click(
      within((await screen.findByText('Masaki 3BR Apartment')).closest('tr')!)
        .getByRole('button', {name: /edit/i})
    );
    const dialog = within(await screen.findByRole('dialog'));
    await waitFor(() => expect(dialog.getByLabelText(/^title$/i)).toHaveValue('Masaki 3BR Apartment'));
    await user.click(dialog.getByRole('button', {name: /save changes/i}));

    // Set-the-whole-list operations must reach the server on an edit, or
    // clearing the last amenity would silently do nothing.
    await waitFor(() => {
      expect(setPropertyAmenities).toHaveBeenCalledWith('prop-1', []);
    });
  });
});
