import { z } from 'zod';
import { defineTool, READ_ONLY, ToolInputError, WRITE, type ToolDefinition } from '../../tools.js';
import { compact } from '../../utils/http.js';
import { date, metadata, optionalBool, optionalInt, optionalString, type Builders } from './shared.js';
import { managerFields } from './license-users.js';

const orderLicense = z
  .object({
    key: z.string().optional().describe('License key (key-based products; generated when omitted)'),
    users: z
      .array(z.object({ email: z.string().email(), is_manager: z.boolean().optional(), max_activations: z.number().int().optional() }))
      .optional()
      .describe('License users (user-based products)'),
  })
  .catchall(z.unknown())
  .describe(
    'License definition; besides key/users it accepts any documented license field, e.g. license_type, ' +
    'max_activations, valid_duration, validity_period, is_trial, trial_days, policy_code, product_features, custom_fields',
  );

const orderItem = z.object({
  product_code: z.string().min(1).describe('Product short code'),
  licenses: z.array(orderLicense).min(1).describe('Licenses to create for the product'),
  license_policy: z.string().optional().describe('License policy code'),
  note: z.string().optional(),
  subscription_id: z.string().optional(),
  customer_account_id: z.number().int().optional(),
  active: z.boolean().optional(),
});

export function orderTools(b: Builders): ToolDefinition[] {
  const { call } = b;
  return [
    b.list({ name: 'list_orders', title: 'List Orders', description: 'List orders. Filters include store_id, customer__email__icontains, customer_id, customer__account.', path: '/orders/', orderBy: true }),
    b.retrieve({ name: 'get_order', title: 'Get Order', description: 'Get an order.', path: '/orders/{id}/', what: 'Order' }),
    defineTool({
      name: 'create_order',
      title: 'Create Order',
      description: 'Create an order with one or more licenses. This is how licenses are issued through the Management API.',
      inputSchema: {
        id: z.string().min(1).describe('Unique order ID chosen by you (e.g. a UUID or store order number)'),
        items: z.array(orderItem).min(1),
        customer: z
          .object({
            email: z.string().email().optional(),
            first_name: z.string().optional(),
            last_name: z.string().optional(),
            company_name: z.string().optional(),
            phone: z.string().optional(),
            reference: z.string().optional(),
          })
          .optional(),
        append: optionalBool('Append to an existing order with the same ID'),
        is_test: optionalBool('Test order'),
        is_bundle: optionalBool('Bundle order'),
        created: optionalString('Order creation timestamp'),
        language: optionalString('Language short code'),
        campaign_params: optionalString('Campaign parameters'),
        download_id: optionalString('Custom download ID'),
        prevent_vm: optionalBool('Prevent activation on virtual machines'),
        customer_account_id: optionalInt('Customer account ID'),
        add_to_customer_account: optionalBool('Assign the order to the customer account (default true)'),
        metadata,
      },
      annotations: WRITE,
      run: async ({ metadata: meta, ...order }) =>
        call('POST', '/orders/create_order/', {
          // The API expects order metadata as a serialized JSON string.
          body: compact({ ...order, metadata: meta === undefined ? undefined : JSON.stringify(meta) }),
        }),
    }),
    b.update({
      name: 'update_order',
      title: 'Update Order',
      description: 'Update order fields, including moving it to another customer (customer) or customer account.',
      path: '/orders/{id}/',
      what: 'Order',
      shape: {
        store_id: optionalString('Store order ID'),
        type: optionalString('Order type'),
        is_test: optionalBool('Test order'),
        is_trial: optionalBool('Trial order'),
        download_id: optionalString('Download ID'),
        language: optionalString('Language short code'),
        campaign_params: optionalString('Campaign parameters'),
        customer: optionalInt('Customer ID (changes the customer on the order)'),
        customer_account: optionalInt('Customer account ID'),
      },
    }),
    b.remove({ name: 'delete_order', title: 'Delete Order', description: 'Delete an order and its licenses.', path: '/orders/{id}/safe_delete/', what: 'Order' }),
    b.query({
      name: 'generate_license_keys',
      title: 'Generate License Keys',
      description: 'Generate unused license keys for a product (keys are not assigned until used in an order).',
      path: '/orders/generate_license/',
      shape: {
        product: z.string().min(1).describe('Product short code'),
        quantity: z.number().int().min(1).max(10000).default(1).describe('Number of keys (default 1)'),
        key_length: z.number().int().min(16).max(240).optional().describe('Characters per key (16-240, default 16)'),
        alphabet: optionalString('Allowed characters (default 23456789ABCDEFGHJKLMNPQRSTUVWXYZ)'),
      },
    }),
    b.query({
      name: 'export_orders',
      title: 'Export Orders',
      description: 'Export orders created in a period: give range (last30/last60/last180/last365) or from and to dates.',
      path: '/orders/export/',
      shape: {
        range: z.enum(['last30', 'last60', 'last180', 'last365']).optional(),
        from: date('Created after yyyy-mm-dd'),
        to: date('Created before yyyy-mm-dd'),
      },
      validate: (args) => {
        if (!args.range && !(args.from && args.to)) throw new ToolInputError('Provide range, or both from and to');
      },
    }),
    b.action({ name: 'export_order', title: 'Export Order', description: 'Export a single order with its licenses.', path: '/orders/{id}/export/', what: 'Order', method: 'GET', annotations: READ_ONLY }),
    b.action({ name: 'list_order_managers', title: 'List Order Managers', description: 'List the license managers of an order.', path: '/orders/{id}/managers/', what: 'Order', method: 'GET' }),
    b.action({
      name: 'add_order_manager',
      title: 'Add Order Manager',
      description: 'Add a license manager (by email; created when missing) to an order.',
      path: '/orders/{id}/add_manager/',
      what: 'Order',
      annotations: WRITE,
      shape: managerFields,
    }),
    b.action({
      name: 'add_order_managers',
      title: 'Add Order Managers (Bulk)',
      description: 'Add several license managers to an order.',
      path: '/orders/{id}/add_managers/',
      what: 'Order',
      annotations: WRITE,
      shape: { managers: z.array(z.object(managerFields)).min(1) },
      body: (args) => args.managers,
    }),
    b.action({
      name: 'remove_order_manager',
      title: 'Remove Order Manager',
      description: 'Remove a license manager from an order.',
      path: '/orders/{id}/remove_manager/',
      what: 'Order',
      shape: { license_user_id: z.number().int().positive().describe('License user ID') },
    }),
  ];
}
