import { describe, expect, it, vi } from 'vitest';
import Logger, { licenseApiLogger, LogLevel, managementApiLogger, parseLogLevel, serializeError } from '../../src/utils/logger.js';

describe('parseLogLevel', () => {
  it.each([
    ['error', LogLevel.ERROR],
    ['WARN', LogLevel.WARN],
    ['info', LogLevel.INFO],
    ['debug', LogLevel.DEBUG],
  ])('parses %s', (value, level) => {
    expect(parseLogLevel(value, undefined)).toBe(level);
  });

  it('defaults by environment', () => {
    expect(parseLogLevel(undefined, 'production')).toBe(LogLevel.WARN);
    expect(parseLogLevel('bogus', 'development')).toBe(LogLevel.INFO);
  });
});

describe('serializeError', () => {
  it('serializes errors and other values', () => {
    expect(serializeError(new TypeError('boom'))).toMatchObject({ name: 'TypeError', message: 'boom' });
    expect(serializeError('plain')).toEqual({ error: 'plain' });
  });
});

describe('Logger', () => {
  it('writes readable lines and filters by level', () => {
    const lines: string[] = [];
    const logger = new Logger('svc', LogLevel.INFO, false, (line) => lines.push(line));
    logger.debug('hidden');
    logger.info('hello', { a: 1 });
    logger.warn('careful');
    logger.error('failed', new Error('x'), { b: 2 });
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/svc: hello \{"a":1\}$/);
    expect(lines[1]).toMatch(/svc: careful$/);
    expect(lines[2]).toContain('failed {"b":2} {"name":"Error","message":"x"');
  });

  it('writes JSON lines in production mode', () => {
    const lines: string[] = [];
    const logger = new Logger('svc', LogLevel.DEBUG, true, (line) => lines.push(line));
    logger.debug('dbg');
    logger.error('err', 'reason');
    expect(JSON.parse(lines[0])).toMatchObject({ level: 'DEBUG', service: 'svc', message: 'dbg' });
    expect(JSON.parse(lines[1])).toMatchObject({ level: 'ERROR', error: { error: 'reason' } });
  });

  it('writes to stderr by default, never stdout', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const stdout = vi.spyOn(process.stdout, 'write');
    new Logger('svc', LogLevel.INFO, false).info('to stderr');
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('to stderr\n'));
    expect(stdout).not.toHaveBeenCalled();
  });

  it('exports service loggers', () => {
    expect(licenseApiLogger).toBeInstanceOf(Logger);
    expect(managementApiLogger).toBeInstanceOf(Logger);
  });
});
