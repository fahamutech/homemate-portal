import {describe, expect, it} from 'vitest';
import {landlordColumnLabel} from './labels';

describe('the Landlord column on Properties', () => {
  it('a broker listing with nobody attached yet says so, not "Not needed"', () => {
    expect(landlordColumnLabel({kind: 'broker', user_id: 'b', name: 'Juma'}, 'not_required')).toBe('No landlord yet');
  });

  it('a landlord listing their own home, or a backoffice listing, needs no confirmation', () => {
    expect(landlordColumnLabel({kind: 'landlord', user_id: 'l', name: 'Amina'}, 'not_required')).toBe('Not needed');
    expect(landlordColumnLabel({kind: 'backoffice', user_id: null, name: null}, 'not_required')).toBe('Not needed');
    expect(landlordColumnLabel(undefined, 'not_required')).toBe('Not needed');
  });

  it('otherwise it is the confirmation itself', () => {
    expect(landlordColumnLabel({kind: 'broker', user_id: 'b', name: 'Juma'}, 'pending')).toBe('Waiting');
    expect(landlordColumnLabel({kind: 'broker', user_id: 'b', name: 'Juma'}, 'confirmed')).toBe('Confirmed');
    expect(landlordColumnLabel({kind: 'broker', user_id: 'b', name: 'Juma'}, 'disputed')).toBe('Disputed');
  });
});
