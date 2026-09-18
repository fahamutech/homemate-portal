import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {PropertyFormModal} from './PropertyFormModal';
import {renderAdminScreen} from './testUtils';
import {createFakeAdminApi} from '../../api/adminApi.fake';
import {AdminApiError} from '../../api/adminApi';

/**
 * Leaflet needs a real layout engine, so the map itself is stubbed — the
 * picker's contract with the form (it reports coordinates) is what matters
 * here and is covered by driving `onChange` through the search results.
 */
vi.mock('./LocationPicker', () => ({
  LocationPicker: ({onChange}: {onChange: (l: {latitude: number; longitude: number; addressLine?: string}) => void}) => (
    <button
      type="button"
      onClick={() => onChange({latitude: -6.746, longitude: 39.2803, addressLine: 'Masaki, Dar es Salaam'})}
    >
      Pick Masaki on the map
    </button>
  ),
}));

vi.mock('./imagePipeline', async () => {
  const actual = await vi.importActual<typeof import('./imagePipeline')>('./imagePipeline');
  return {
    ...actual,
    prepareImages: vi.fn(async (files: File[]) => ({
      prepared: files.map((file) => ({
        originalName: file.name,
        originalSizeBytes: 4_000_000,
        previewUrl: 'blob:preview',
        image: {base64: 'AAAA', name: 'front.webp', contentType: 'image/webp' as const, width: 1920, height: 1440, sizeBytes: 250_000},
        thumbnail: {base64: 'BBBB', name: 'front-thumb.webp', contentType: 'image/webp' as const, width: 400, height: 300, sizeBytes: 20_000},
      })),
      errors: [],
    })),
  };
});

function step(name: string | RegExp) {
  return screen.getByRole('button', {name});
}

beforeEach(() => {
  vi.stubGlobal('URL', {createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn()} as unknown as typeof URL);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PropertyFormModal', () => {
  test('catches a missing title even when submitted from another step', async () => {
    // Steps unmount their fields, so the browser's `required` only guards the
    // step you are on — the JS check is the backstop, and it must send you
    // back to the step that needs fixing.
    const api = createFakeAdminApi();
    const createProperty = vi.spyOn(api, 'createProperty');
    const user = userEvent.setup();
    renderAdminScreen(<PropertyFormModal onClose={vi.fn()} onSaved={vi.fn()} />, {api});

    await user.click(step('Photos'));
    expect(screen.queryByLabelText(/^title$/i)).not.toBeInTheDocument();

    await user.click(step(/save property/i));

    expect(await screen.findByRole('alert')).toHaveTextContent(/title is required/i);
    expect(createProperty).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^title$/i)).toBeInTheDocument();
  });

  test('asks for the number of months when the payment mode is custom', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PropertyFormModal onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(step('Terms & pricing'));
    expect(screen.queryByLabelText(/months per payment/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/payment mode/i), 'custom');
    expect(screen.getByLabelText(/months per payment/i)).toBeInTheDocument();
  });

  test('estimates the total monthly cost from rent plus mandatory charges', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PropertyFormModal onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(step('Terms & pricing'));
    await user.type(screen.getByLabelText(/rent \/ price/i), '1000000');

    await user.click(step('Amenities & charges'));
    await user.click(screen.getByRole('button', {name: /add a charge/i}));
    await user.type(screen.getByLabelText(/charge 1 name/i), 'Service charge');
    await user.type(screen.getByLabelText(/charge 1 amount/i), '60000');
    await user.selectOptions(screen.getByLabelText(/charge 1 frequency/i), 'quarterly');

    // 1,000,000 + 60,000/3
    expect(screen.getByText(/1,020,000/)).toBeInTheDocument();
  });

  test('an optional charge is excluded from the recurring estimate', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PropertyFormModal onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(step('Terms & pricing'));
    await user.type(screen.getByLabelText(/rent \/ price/i), '1000000');
    await user.click(step('Amenities & charges'));
    await user.click(screen.getByRole('button', {name: /add a charge/i}));
    await user.type(screen.getByLabelText(/charge 1 amount/i), '50000');
    await user.click(screen.getByLabelText(/mandatory/i));

    expect(screen.getByText(/TZS 1,000,000/)).toBeInTheDocument();
  });

  test('saves the property, then its amenities, charges, parties and photos', async () => {
    const api = createFakeAdminApi();
    const createProperty = vi.spyOn(api, 'createProperty');
    const setPropertyAmenities = vi.spyOn(api, 'setPropertyAmenities');
    const addPropertyCharge = vi.spyOn(api, 'addPropertyCharge');
    const assignPropertyParty = vi.spyOn(api, 'assignPropertyParty');
    const uploadPropertyImage = vi.spyOn(api, 'uploadPropertyImage');
    const onSaved = vi.fn();
    const user = userEvent.setup();

    renderAdminScreen(<PropertyFormModal onClose={vi.fn()} onSaved={onSaved} />, {api});

    // Basics
    await user.type(screen.getByLabelText(/^title$/i), 'Masaki 3BR Apartment');
    await user.selectOptions(screen.getByLabelText(/property type/i), 'dict-type-1');

    // Location (map stub reports coordinates)
    await user.click(step('Location'));
    await user.click(screen.getByRole('button', {name: /pick masaki on the map/i}));

    // Terms
    await user.click(step('Terms & pricing'));
    await user.type(screen.getByLabelText(/rent \/ price/i), '1500000');
    await user.selectOptions(screen.getByLabelText(/payment mode/i), 'quarterly');

    // Amenities + a charge
    await user.click(step('Amenities & charges'));
    await user.click(screen.getByRole('button', {name: /add a charge/i}));
    await user.type(screen.getByLabelText(/charge 1 name/i), 'Service charge');
    await user.type(screen.getByLabelText(/charge 1 amount/i), '120000');

    // People
    await user.click(step('People'));
    await user.selectOptions(screen.getByLabelText(/^landlord$/i), 'user-1');

    // Photos
    await user.click(step('Photos'));
    const file = new File(['bytes'], 'front.jpg', {type: 'image/jpeg'});
    await user.upload(screen.getByLabelText(/property photos/i), file);
    expect(await screen.findByText(/cover ·/i)).toBeInTheDocument();

    await user.click(step(/save property/i));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(createProperty).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Masaki 3BR Apartment',
        latitude: -6.746,
        longitude: 39.2803,
        addressLine: 'Masaki, Dar es Salaam',
        paymentFrequency: 'quarterly',
        price: '1500000',
      })
    );
    expect(addPropertyCharge).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({name: 'Service charge', amount: '120000'})
    );
    expect(assignPropertyParty).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({userId: 'user-1', role: 'landlord'})
    );
    expect(uploadPropertyImage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        image: expect.objectContaining({contentType: 'image/webp'}),
        thumbnail: expect.objectContaining({contentType: 'image/webp'}),
        isCover: true,
      })
    );
    // no amenity was ticked, so no needless call
    expect(setPropertyAmenities).not.toHaveBeenCalled();
  });

  test('surfaces a server refusal and does not report success', async () => {
    const api = createFakeAdminApi({
      createProperty: vi.fn().mockRejectedValue(
        new AdminApiError('VALIDATION_FAILED', 'latitude and longitude must be provided together', 400)
      ),
    });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderAdminScreen(<PropertyFormModal onClose={vi.fn()} onSaved={onSaved} />, {api});

    await user.type(screen.getByLabelText(/^title$/i), 'Half-specified');
    await user.click(step(/save property/i));

    expect(await screen.findByRole('alert')).toHaveTextContent(/latitude and longitude/i);
    expect(onSaved).not.toHaveBeenCalled();
  });

  test('a photo can be removed before saving', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PropertyFormModal onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(step('Photos'));
    await user.upload(
      screen.getByLabelText(/property photos/i),
      new File(['bytes'], 'front.jpg', {type: 'image/jpeg'})
    );
    const photos = await screen.findByRole('list');
    expect(within(photos).getAllByRole('listitem')).toHaveLength(1);

    await user.click(within(photos).getByRole('button', {name: /remove/i}));
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
