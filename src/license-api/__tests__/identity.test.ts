import { ValidationError } from '../../utils/http.js';
import { pickFullIdentity, pickKeyOrUser } from '../identity.js';

describe('pickKeyOrUser', () => {
  it('accepts license_key or username', () => {
    expect(pickKeyOrUser({ license_key: 'K' })).toEqual({ license_key: 'K', username: undefined, license_id: undefined });
    expect(pickKeyOrUser({ username: 'u@x.com', license_id: 3 })).toEqual({ license_key: undefined, username: 'u@x.com', license_id: 3 });
  });
  it('rejects none or both', () => {
    expect(() => pickKeyOrUser({})).toThrow(ValidationError);
    expect(() => pickKeyOrUser({ license_key: 'K', username: 'u' })).toThrow(/exactly one/);
  });
});

describe('pickFullIdentity', () => {
  it('accepts each identity set and drops unrelated fields', () => {
    expect(pickFullIdentity({ license_key: 'K', password: 'ignored', customer_account_code: 'ignored' }))
      .toEqual({ license_key: 'K', username: undefined, password: undefined, id_token: undefined, code: undefined, customer_account_code: undefined, license_id: undefined });
    expect(pickFullIdentity({ username: 'u', password: 'p' })).toMatchObject({ username: 'u', password: 'p' });
    expect(pickFullIdentity({ id_token: 't', customer_account_code: 'acme' })).toMatchObject({ id_token: 't', customer_account_code: 'acme' });
    expect(pickFullIdentity({ code: 'c', customer_account_code: 'acme', license_id: 9 })).toMatchObject({ code: 'c', customer_account_code: 'acme', license_id: 9 });
  });

  it.each([
    [{}, /exactly one identity/],
    [{ license_key: 'K', username: 'u', password: 'p' }, /exactly one identity/],
    [{ id_token: 't', code: 'c', customer_account_code: 'a' }, /exactly one identity/],
    [{ username: 'u' }, /password is required/],
    [{ id_token: 't' }, /customer_account_code is required/],
    [{ code: 'c' }, /customer_account_code is required/],
  ])('rejects %p', (args, message) => {
    expect(() => pickFullIdentity(args)).toThrow(message);
  });
});
