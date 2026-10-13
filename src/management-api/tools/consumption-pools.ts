import { z } from 'zod';
import type { ToolDefinition } from '../../tools.js';
import { consumptionPeriod, id, optionalBool, optionalInt, optionalString, type Builders } from './shared.js';

const poolFields = {
  name: optionalString('Pool name'),
  max_consumptions: optionalInt('Maximum consumptions (default 0)'),
  total_consumptions: optionalInt('Consumptions used (default 0)'),
  allow_unlimited_consumptions: optionalBool('Unlimited consumptions'),
  allow_negative_consumptions: optionalBool('Allow negative consumptions (default true)'),
  allow_overages: optionalBool('Allow overages'),
  max_overages: optionalInt('Maximum overages'),
  reset_consumption: optionalBool('Reset consumption each period'),
  consumption_period: consumptionPeriod,
  offline_default_checkout: optionalInt('Default offline checkout amount'),
};

/** Consumption pools share consumptions between licenses or license features of a customer account. */
export function consumptionPoolTools(b: Builders): ToolDefinition[] {
  return [
    b.list({
      name: 'list_consumption_pools',
      title: 'List Consumption Pools',
      description: 'List consumption pools. Filters: customer_account, name__icontains, type.',
      path: '/consumption-pools/',
      orderBy: true,
      extra: { customer_account: optionalInt('Customer account ID') },
    }),
    b.retrieve({ name: 'get_consumption_pool', title: 'Get Consumption Pool', description: 'Get a consumption pool.', path: '/consumption-pools/{id}/', what: 'Consumption pool' }),
    b.create({
      name: 'create_consumption_pool',
      title: 'Create Consumption Pool',
      description: 'Create a consumption pool on a customer account (requires the consumption pools plan feature).',
      path: '/consumption-pools/',
      shape: {
        customer_account: id('Customer account'),
        code: z.string().min(1).describe('Code, unique per customer account'),
        type: z.enum(['license', 'license_product_feature']).describe('What the pool is shared between'),
        ...poolFields,
        name: z.string().min(1).describe('Pool name'),
      },
    }),
    b.update({
      name: 'update_consumption_pool',
      title: 'Update Consumption Pool',
      description: 'Update a consumption pool.',
      path: '/consumption-pools/{id}/',
      what: 'Consumption pool',
      shape: { customer_account: optionalInt('Customer account ID'), ...poolFields },
    }),
    b.remove({ name: 'delete_consumption_pool', title: 'Delete Consumption Pool', description: 'Delete a consumption pool.', path: '/consumption-pools/{id}/', what: 'Consumption pool' }),
    b.list({
      name: 'list_consumption_pool_members',
      title: 'List Consumption Pool Members',
      description: 'List the licenses or license features in a consumption pool. Filter: id__in.',
      path: '/consumption-pools/{id}/members/',
      parent: 'Consumption pool',
    }),
    b.list({
      name: 'list_consumption_pool_license_checkouts',
      title: 'List Consumption Pool License Checkouts',
      description: 'List offline license checkouts from consumption pools. Filters: consumption_pool, device, license, synced_at__isnull.',
      path: '/consumption-pool-license-checkouts/',
      orderBy: true,
    }),
    b.retrieve({ name: 'get_consumption_pool_license_checkout', title: 'Get Consumption Pool License Checkout', description: 'Get a consumption pool license checkout.', path: '/consumption-pool-license-checkouts/{id}/', what: 'Checkout' }),
    b.list({
      name: 'list_consumption_pool_feature_checkouts',
      title: 'List Consumption Pool Feature Checkouts',
      description: 'List offline license feature checkouts from consumption pools. Filters: consumption_pool, device, license_product_feature, synced_at__isnull.',
      path: '/consumption-pool-license-feature-checkouts/',
      orderBy: true,
    }),
    b.retrieve({ name: 'get_consumption_pool_feature_checkout', title: 'Get Consumption Pool Feature Checkout', description: 'Get a consumption pool license feature checkout.', path: '/consumption-pool-license-feature-checkouts/{id}/', what: 'Checkout' }),
  ];
}
