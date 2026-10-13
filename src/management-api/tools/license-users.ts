import { z } from 'zod';
import { defineTool, IDEMPOTENT_WRITE, ToolInputError, WRITE, type ToolDefinition } from '../../tools.js';

import { id, metadata, optionalBool, optionalInt, optionalString, requireOneOf, type Builders } from './shared.js';

const managerFields = {
  email: z.string().email(),
  password: optionalString('Initial password (generated when omitted)'),
  first_name: optionalString('First name'),
  last_name: optionalString('Last name'),
};

export function licenseUserTools(b: Builders): ToolDefinition[] {
  const { call } = b;
  return [
    // Assignment to licenses
    b.action({
      name: 'assign_user_to_license',
      title: 'Assign User to License',
      description: 'Assign a license user (by email) to a user-based license; the user is created when missing.',
      path: '/licenses/{id}/assign_user/',
      what: 'License',
      idKey: 'license_id',
      annotations: WRITE,
      shape: {
        email: z.string().email(),
        first_name: optionalString('First name'),
        last_name: optionalString('Last name'),
        phone_number: optionalString('Phone number'),
        is_manager: optionalBool('Make the user a license manager'),
        password: optionalString('Initial password (generated when omitted)'),
        max_activations: optionalInt('Maximum activations for this user'),
        total_activations: optionalInt('Total activations already used'),
      },
    }),
    b.action({
      name: 'assign_users_to_license',
      title: 'Assign Users to License (Bulk)',
      description: 'Assign several license users (by email) to a user-based license.',
      path: '/licenses/{id}/assign_users/',
      what: 'License',
      idKey: 'license_id',
      annotations: WRITE,
      shape: { emails: z.array(z.object({ email: z.string().email(), is_manager: z.boolean().optional() })).min(1) },
    }),
    b.action({
      name: 'unassign_user_from_license',
      title: 'Unassign User from License',
      description: 'Remove a license user from a license, by license user ID or email.',
      path: '/licenses/{id}/unassign_user/',
      what: 'License',
      idKey: 'license_id',
      shape: {
        license_user_id: z.number().int().positive().optional().describe('License user ID'),
        license_user_email: z.string().email().optional().describe('License user email'),
      },
      validate: (args) => requireOneOf(args, ['license_user_id', 'license_user_email']),
    }),
    b.action({
      name: 'set_user_activations',
      title: 'Set User Activations',
      description: 'Set max activations and/or reset total activations for license users on a license.',
      path: '/licenses/{id}/set_users_activations/',
      what: 'License',
      idKey: 'license_id',
      annotations: IDEMPOTENT_WRITE,
      shape: {
        user_activations: z
          .record(
            z.string().regex(/^\d+$/, 'Keys must be license user IDs'),
            z.object({ max_activations: z.number().int().min(0).optional(), reset_total_activations: z.boolean().optional() }),
          )
          .refine((value) => Object.keys(value).length > 0, 'At least one license user is required')
          .describe('Map of license user ID to activation settings'),
      },
      body: (args) => args.user_activations,
    }),

    // License users
    b.list({ name: 'list_license_users', title: 'List License Users', description: 'List license users. Filters include true_email__icontains, true_email__iexact, is_license_manager, license__order__customer_account.', path: '/license-users/' }),
    b.retrieve({ name: 'get_license_user', title: 'Get License User', description: 'Get a license user.', path: '/license-users/{id}/', what: 'License user' }),
    b.create({
      name: 'create_license_user',
      title: 'Create License User',
      description: 'Create a license user.',
      path: '/license-users/',
      shape: {
        email: z.string().email(),
        first_name: optionalString('First name'),
        last_name: optionalString('Last name'),
        phone_number: optionalString('Phone number'),
        password: optionalString('Initial password (generated when omitted)'),
        metadata,
      },
    }),
    b.update({
      name: 'update_license_user',
      title: 'Update License User',
      description: 'Update the name or phone number of a license user.',
      path: '/license-users/{id}/',
      what: 'License user',
      shape: { first_name: optionalString('First name'), last_name: optionalString('Last name'), phone_number: optionalString('Phone number') },
    }),
    b.remove({ name: 'delete_license_user', title: 'Delete License User', description: 'Delete a license user.', path: '/license-users/{id}/', what: 'License user' }),
    defineTool({
      name: 'set_license_user_password',
      title: 'Set License User Password',
      description: 'Set the password of a license user, identified by ID or email.',
      inputSchema: {
        id: z.number().int().positive().optional().describe('License user ID'),
        email: z.string().email().optional().describe('License user email'),
        password: z.string().min(1).describe('New password'),
      },
      annotations: IDEMPOTENT_WRITE,
      run: async ({ id: value, email, password }) => {
        if (value) return call('POST', `/license-users/${value as number}/set_password/`, { body: { password } });
        if (email) return call('POST', '/license-users/set_password/', { query: { email }, body: { password } });
        throw new ToolInputError('Provide id or email');
      },
    }),
    b.action({
      name: 'add_license_user_to_group',
      title: 'Add License User to Group',
      description: 'Add a license user to a license user group.',
      path: '/license-users/{id}/add_to_group/',
      what: 'License user',
      annotations: IDEMPOTENT_WRITE,
      shape: { license_user_group_id: id('License user group') },
    }),
    b.action({
      name: 'remove_license_user_from_group',
      title: 'Remove License User from Group',
      description: 'Remove a license user from a license user group.',
      path: '/license-users/{id}/remove_from_group/',
      what: 'License user',
      shape: { license_user_group_id: id('License user group') },
    }),

    // License manager permissions
    b.list({ name: 'list_license_manager_permissions', title: 'List License Manager Permissions', description: 'List the permissions that can be granted to license managers.', path: '/license-manager-permissions/' }),
    b.action({
      name: 'update_license_manager_permissions',
      title: 'Update License Manager Permissions',
      description: 'Grant license manager permissions to a license user, scoped to products, license policies and customer accounts.',
      path: '/license-users/{id}/update_lm_permissions/',
      what: 'License user',
      annotations: IDEMPOTENT_WRITE,
      shape: {
        permission_ids: z.array(z.number().int()).optional().describe('License manager permission IDs'),
        products: z
          .array(z.object({ product_id: z.number().int(), num_of_licenses: z.number().int().nullable().optional() }))
          .optional()
          .describe('Products the manager may issue licenses for, with an optional license count limit'),
        license_templates: z.array(z.number().int()).optional().describe('License policy (template) IDs'),
        customer_account_ids: z.array(z.number().int()).optional().describe('Customer account IDs'),
      },
    }),
    b.action({
      name: 'remove_license_manager_permissions',
      title: 'Remove License Manager Permissions',
      description: 'Remove all license manager permissions from a license user.',
      path: '/license-users/{id}/remove_lm_permissions/',
      what: 'License user',
    }),

    // License user groups
    b.list({
      name: 'list_license_user_groups',
      title: 'List License User Groups',
      description: 'List license user groups. Filters include customer_account, customer_account__code, license_managers__id.',
      path: '/license-user-groups/',
      extra: { customer_account: optionalInt('Customer account ID') },
    }),
    b.retrieve({ name: 'get_license_user_group', title: 'Get License User Group', description: 'Get a license user group.', path: '/license-user-groups/{id}/', what: 'License user group' }),
    b.create({
      name: 'create_license_user_group',
      title: 'Create License User Group',
      description: 'Create a license user group.',
      path: '/license-user-groups/',
      shape: {
        code: z.string().min(1).describe('Group code'),
        name: optionalString('Name'),
        description: optionalString('Description'),
        customer_account: optionalInt('Customer account ID'),
        metadata,
      },
    }),
    b.update({
      name: 'update_license_user_group',
      title: 'Update License User Group',
      description: 'Update a license user group.',
      path: '/license-user-groups/{id}/',
      what: 'License user group',
      shape: { name: optionalString('Name'), description: optionalString('Description'), customer_account: optionalInt('Customer account ID'), metadata },
    }),
    b.remove({ name: 'delete_license_user_group', title: 'Delete License User Group', description: 'Delete a license user group.', path: '/license-user-groups/{id}/', what: 'License user group' }),
    b.action({ name: 'list_license_user_group_members', title: 'List License User Group Members', description: 'List the license users in a group.', path: '/license-user-groups/{id}/members/', what: 'License user group', method: 'GET' }),
    b.action({ name: 'list_license_user_group_managers', title: 'List License User Group Managers', description: 'List the managers of a license user group.', path: '/license-user-groups/{id}/managers/', what: 'License user group', method: 'GET' }),
    b.action({
      name: 'add_license_user_group_manager',
      title: 'Add License User Group Manager',
      description: 'Add a manager (by email; created when missing) to a license user group.',
      path: '/license-user-groups/{id}/add_manager/',
      what: 'License user group',
      annotations: WRITE,
      shape: managerFields,
    }),
    b.action({
      name: 'remove_license_user_group_manager',
      title: 'Remove License User Group Manager',
      description: 'Remove a manager from a license user group.',
      path: '/license-user-groups/{id}/remove_manager/',
      what: 'License user group',
      shape: { license_user_id: id('License user') },
    }),
  ];
}

export { managerFields };
