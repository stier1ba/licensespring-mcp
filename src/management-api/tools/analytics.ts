import { z } from 'zod';
import type { ToolDefinition } from '../../tools.js';
import { optionalInt, type Builders } from './shared.js';

const HOURLY = [
  ['list_hourly_activities', 'List Hourly Activities', 'Hourly aggregated API activity.', '/activities-hourly/'],
  ['list_hourly_activity_action_stats', 'List Hourly Activity Action Stats', 'API call counts per action.', '/activities-hourly/actions_stats/'],
  ['list_hourly_activity_top_customers', 'List Top Customers by API Calls', 'Customers with the most API calls.', '/activities-hourly/top_call_count_customers/'],
  ['list_hourly_activity_top_licenses', 'List Top Licenses by API Calls', 'Licenses with the most API calls.', '/activities-hourly/top_call_count_licenses/'],
  ['list_hourly_activity_top_orders', 'List Top Orders by API Calls', 'Orders with the most API calls.', '/activities-hourly/top_call_count_orders/'],
  ['list_hourly_activity_total_calls', 'List Total API Call Counts', 'Total API call counts.', '/activities-hourly/total_call_count/'],
] as const;

const ACTIVITY_FILTERS = ' Filters: action__in, product__in, license__in, status_code__in, ts__gte/lte/gt/lt, ts__date__gte/lte, status_code__gte/lte.';

export function analyticsTools(b: Builders): ToolDefinition[] {
  return [
    b.list({ name: 'list_activities', title: 'List Activities', description: `List API activity records.${ACTIVITY_FILTERS}`, path: '/activities/' }),
    ...HOURLY.map(([name, title, description, path]) => b.list({ name, title, description: description + ACTIVITY_FILTERS, path })),

    b.list({
      name: 'list_license_activation_histories',
      title: 'List License Activation Histories',
      description: 'List activation/deactivation history. Filters: license, action, ts__gte, ts__lte, ts__date__gte, ts__date__lte.',
      path: '/license-activation-histories/',
      extra: { license: optionalInt('License ID') },
    }),
    b.retrieve({ name: 'get_license_activation_history', title: 'Get License Activation History', description: 'Get an activation history entry.', path: '/license-activation-histories/{id}/', what: 'Activation history' }),
    b.list({
      name: 'count_license_transfers',
      title: 'Count License Transfers',
      description: 'Count license transfers (activations on a different device than the previous one). Filters: license, ts__gte, ts__lte.',
      path: '/license-activation-histories/transfer_count/',
      paginated: false,
      extra: { license: optionalInt('License ID') },
    }),
    b.list({
      name: 'list_license_usage_histories',
      title: 'List License Usage Histories',
      description: 'List license usage history entries. Filters: license, ts__gte, ts__lte.',
      path: '/license-histories/',
      extra: { license: optionalInt('License ID') },
    }),
    b.retrieve({ name: 'get_license_usage_history', title: 'Get License Usage History', description: 'Get a license usage history entry.', path: '/license-histories/{id}/', what: 'Usage history' }),
    b.query({
      name: 'export_license_usage_histories',
      title: 'Export License Usage Histories',
      description: 'Export license usage history for a window of at most 24 hours.',
      path: '/license-histories/export',
      shape: {
        ts__gte: z.string().min(1).describe('Start timestamp (ISO 8601)'),
        ts__lte: z.string().min(1).describe('End timestamp (ISO 8601), at most 24 hours after ts__gte'),
        license: optionalInt('License ID'),
      },
    }),
  ];
}
