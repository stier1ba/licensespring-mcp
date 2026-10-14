import { z } from 'zod';
import { ValidationError } from '../utils/http.js';

/**
 * Most License API endpoints identify a license by `license_key` (key-based
 * licenses) OR `username` (user-based licenses). `license_id` disambiguates
 * when a user has several licenses for the same product.
 */
export const keyOrUserShape = {
  license_key: z.string().min(1).optional().describe('License key (key-based licenses). Provide this OR username.'),
  username: z.string().min(1).optional().describe('License user email (user-based licenses). Provide this OR license_key.'),
  license_id: z.number().int().positive().optional().describe('Specific license ID, when a user has several licenses for the product'),
};

/**
 * Activate, deactivate and borrow additionally accept a password (user-based)
 * or SSO credentials (id_token / code + customer_account_code).
 */
export const fullIdentityShape = {
  ...keyOrUserShape,
  password: z.string().min(1).optional().describe('License user password (required with username)'),
  id_token: z.string().min(1).optional().describe('SSO id_token (implicit flow); requires customer_account_code'),
  code: z.string().min(1).optional().describe('SSO authorization code; requires customer_account_code'),
  customer_account_code: z.string().min(1).optional().describe('Customer account code for SSO activation'),
};

export interface KeyOrUser {
  license_key?: string;
  username?: string;
  license_id?: number;
}

export interface FullIdentity extends KeyOrUser {
  password?: string;
  id_token?: string;
  code?: string;
  customer_account_code?: string;
}

export function pickKeyOrUser(args: KeyOrUser): KeyOrUser {
  if (!!args.license_key === !!args.username) {
    throw new ValidationError('Provide exactly one of license_key (key-based) or username (user-based).');
  }
  return { license_key: args.license_key, username: args.username, license_id: args.license_id };
}

export function pickFullIdentity(args: FullIdentity): FullIdentity {
  const sets = [
    args.license_key ? 'license_key' : undefined,
    args.username ? 'username' : undefined,
    args.id_token ? 'id_token' : undefined,
    args.code ? 'code' : undefined,
  ].filter(Boolean);
  if (sets.length !== 1) {
    throw new ValidationError(
      'Provide exactly one identity: license_key, username + password, id_token + customer_account_code, or code + customer_account_code.',
    );
  }
  if (args.username && !args.password) {
    throw new ValidationError('password is required when using username (user-based license).');
  }
  if ((args.id_token || args.code) && !args.customer_account_code) {
    throw new ValidationError('customer_account_code is required for SSO (id_token or code).');
  }
  return {
    license_key: args.license_key,
    username: args.username,
    password: args.username ? args.password : undefined,
    id_token: args.id_token,
    code: args.code,
    customer_account_code: args.id_token || args.code ? args.customer_account_code : undefined,
    license_id: args.license_id,
  };
}
