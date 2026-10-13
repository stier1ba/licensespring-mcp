import { z } from 'zod';
import { WRITE, type ToolDefinition } from '../../tools.js';
import { hexColor, id, metadata, optionalInt, optionalString, type Builders } from './shared.js';
import { managerFields } from './license-users.js';

const customerFields = {
  first_name: optionalString('First name'),
  last_name: optionalString('Last name'),
  company_name: optionalString('Company name'),
  phone: optionalString('Phone'),
  reference: optionalString('Custom reference, e.g. your CRM ID'),
  address: optionalString('Address'),
  postcode: optionalString('Postcode'),
  city: optionalString('City'),
  state: optionalString('State'),
  country: optionalString('Country'),
  customer_account: optionalInt('Customer account ID'),
  metadata,
};

const accountFields = {
  name: optionalString('Name'),
  description: optionalString('Description'),
  phone: optionalString('Phone'),
  address: optionalString('Address'),
  email: z.string().email().optional(),
};

export function customerTools(b: Builders): ToolDefinition[] {
  return [
    b.list({
      name: 'list_customers',
      title: 'List Customers',
      description: 'List customers. Filters include email__icontains, company_name__icontains, reference, label__in, account__code.',
      path: '/customers/',
      extra: { email: optionalString('Exact customer email') },
    }),
    b.retrieve({ name: 'get_customer', title: 'Get Customer', description: 'Get a customer.', path: '/customers/{id}/', what: 'Customer' }),
    b.create({ name: 'create_customer', title: 'Create Customer', description: 'Create a customer.', path: '/customers/', shape: { email: z.string().email(), ...customerFields } }),
    b.update({ name: 'update_customer', title: 'Update Customer', description: 'Update a customer.', path: '/customers/{id}/', what: 'Customer', shape: { email: z.string().email().optional(), ...customerFields } }),
    b.remove({ name: 'delete_customer', title: 'Delete Customer', description: 'Delete a customer.', path: '/customers/{id}/', what: 'Customer' }),
    b.action({
      name: 'merge_customers',
      title: 'Merge Customers',
      description: 'Move all orders of customer_to_merge_id onto the customer `id`, then delete customer_to_merge_id.',
      path: '/customers/{id}/merge/',
      what: 'Customer to keep',
      shape: { customer_to_merge_id: id('Customer to merge and delete') },
    }),
    b.query({ name: 'export_customers', title: 'Export Customers', description: 'Export all customers.', path: '/customers/export/', shape: {} }),
    b.upload({
      name: 'import_customers_from_csv',
      title: 'Import Customers from CSV',
      description: 'Import customers from CSV content. Headers: email, first_name, last_name, company_name, phone, reference, address, postcode, state, city, country.',
      path: '/customers/import_from_csv/',
      defaultFileName: 'customers.csv',
    }),
    b.list({ name: 'list_customer_import_results', title: 'List Customer Import Results', description: 'List results of CSV customer imports. Filter: status__iexact.', path: '/customers-import-results/' }),
    b.retrieve({ name: 'get_customer_import_result', title: 'Get Customer Import Result', description: 'Get a CSV customer import result.', path: '/customers-import-results/{id}/', what: 'Import result' }),

    // Labels
    b.list({ name: 'list_customer_labels', title: 'List Customer Labels', description: 'List customer labels.', path: '/clabels/' }),
    b.retrieve({ name: 'get_customer_label', title: 'Get Customer Label', description: 'Get a customer label.', path: '/clabels/{id}/', what: 'Customer label' }),
    b.create({
      name: 'create_customer_label',
      title: 'Create Customer Label',
      description: 'Create a customer label.',
      path: '/clabels/',
      shape: { label: z.string().min(1).describe('Label text'), color: hexColor('Color as #RRGGBB') },
    }),
    b.update({
      name: 'update_customer_label',
      title: 'Update Customer Label',
      description: 'Update a customer label.',
      path: '/clabels/{id}/',
      what: 'Customer label',
      shape: { label: optionalString('Label text'), color: hexColor('Color as #RRGGBB') },
    }),
    b.remove({ name: 'delete_customer_label', title: 'Delete Customer Label', description: 'Delete a customer label.', path: '/clabels/{id}/', what: 'Customer label' }),
    b.create({
      name: 'add_label_to_customer',
      title: 'Add Label to Customer',
      description: 'Attach a label to a customer. The returned id is needed to remove it again.',
      path: '/customerclabels/',
      shape: { customer: id('Customer'), customer_label: id('Customer label') },
    }),
    b.remove({ name: 'remove_label_from_customer', title: 'Remove Label from Customer', description: 'Detach a label from a customer (use the customer-label assignment ID).', path: '/customerclabels/{id}/', what: 'Customer label assignment' }),

    // Customer accounts
    b.list({ name: 'list_customer_accounts', title: 'List Customer Accounts', description: 'List customer accounts. Filters: code, name, email, reference.', path: '/customer-accounts/' }),
    b.retrieve({ name: 'get_customer_account', title: 'Get Customer Account', description: 'Get a customer account.', path: '/customer-accounts/{id}/', what: 'Customer account' }),
    b.create({
      name: 'create_customer_account',
      title: 'Create Customer Account',
      description: 'Create a customer account (a company grouping customers and license users).',
      path: '/customer-accounts/',
      shape: { code: z.string().min(1).describe('Unique customer account code'), ...accountFields },
    }),
    b.update({
      name: 'update_customer_account',
      title: 'Update Customer Account',
      description: 'Update a customer account.',
      path: '/customer-accounts/{id}/',
      what: 'Customer account',
      shape: { code: optionalString('Unique customer account code'), ...accountFields },
    }),
    b.remove({ name: 'delete_customer_account', title: 'Delete Customer Account', description: 'Delete a customer account.', path: '/customer-accounts/{id}/', what: 'Customer account' }),
    b.action({ name: 'list_customer_account_managers', title: 'List Customer Account Managers', description: 'List the managers of a customer account.', path: '/customer-accounts/{id}/managers/', what: 'Customer account', method: 'GET' }),
    b.action({
      name: 'add_customer_account_manager',
      title: 'Add Customer Account Manager',
      description: 'Add a manager (by email; created when missing) to a customer account.',
      path: '/customer-accounts/{id}/add_manager/',
      what: 'Customer account',
      annotations: WRITE,
      shape: managerFields,
    }),
    b.action({
      name: 'remove_customer_account_manager',
      title: 'Remove Customer Account Manager',
      description: 'Remove a manager from a customer account.',
      path: '/customer-accounts/{id}/remove_manager/',
      what: 'Customer account',
      shape: { license_user_id: id('License user') },
    }),
  ];
}
