import { z } from 'zod';
import { IDEMPOTENT_WRITE, WRITE, type ToolDefinition } from '../../tools.js';
import { id, optionalInt, optionalString, type Builders } from './shared.js';

export function deviceTools(b: Builders): ToolDefinition[] {
  return [
    b.list({
      name: 'list_devices',
      title: 'List Devices',
      description: 'List devices. Filters include license, hardware_id, hostname, os, blacklisted, device_active, type.',
      path: '/devices/',
      orderBy: true,
      extra: { license: optionalInt('License ID'), hardware_id: optionalString('Hardware ID') },
    }),
    b.retrieve({ name: 'get_device', title: 'Get Device', description: 'Get a device.', path: '/devices/{id}/', what: 'Device' }),
    b.action({ name: 'reset_device', title: 'Reset Device', description: 'Reset (deactivate) a device and free its activation.', path: '/devices/{id}/reset/', what: 'Device' }),
    b.action({ name: 'blacklist_device', title: 'Blacklist Device', description: 'Blacklist a device so it can no longer activate.', path: '/devices/{id}/blacklist/', what: 'Device' }),
    b.action({ name: 'whitelist_device', title: 'Whitelist Device', description: 'Remove a device from the blacklist.', path: '/devices/{id}/whitelist/', what: 'Device', annotations: IDEMPOTENT_WRITE }),
    b.action({
      name: 'borrow_device',
      title: 'Borrow Device',
      description: 'Borrow a floating license for a device until the given time.',
      path: '/devices/{id}/borrow/',
      what: 'Device',
      annotations: WRITE,
      shape: { borrowed_until: z.string().min(1).describe('ISO 8601 date-time, e.g. 2026-04-14T12:30:50') },
    }),
    b.action({ name: 'release_borrowed_device', title: 'Release Borrowed Device', description: 'Release a borrowed floating license from a device.', path: '/devices/{id}/borrow_release/', what: 'Device', annotations: IDEMPOTENT_WRITE }),

    // Device variables
    b.list({ name: 'list_device_variables', title: 'List Device Variables', description: 'List device variables.', path: '/device-variables/', extra: { device: optionalInt('Device ID') } }),
    b.retrieve({ name: 'get_device_variable', title: 'Get Device Variable', description: 'Get a device variable.', path: '/device-variables/{id}/', what: 'Device variable' }),
    b.create({
      name: 'create_device_variable',
      title: 'Create Device Variable',
      description: 'Create a variable on a device.',
      path: '/device-variables/',
      shape: { device: id('Device'), variable: z.string().min(1).describe('Variable name'), value: z.string().describe('Value') },
    }),
    b.update({
      name: 'update_device_variable',
      title: 'Update Device Variable',
      description: 'Rename a device variable or change its value.',
      path: '/device-variables/{id}/',
      what: 'Device variable',
      shape: { variable: optionalString('Variable name'), value: optionalString('Value') },
    }),
    b.remove({ name: 'delete_device_variable', title: 'Delete Device Variable', description: 'Delete a device variable.', path: '/device-variables/{id}/', what: 'Device variable' }),
  ];
}
