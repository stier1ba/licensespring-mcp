import { jest } from '@jest/globals';
import { createLogger, Logger, LogLevel, parseLogLevel, serializeError } from '../logger.js';

describe('parseLogLevel', () => {
  it.each([
    ['error', undefined, LogLevel.ERROR],
    ['WARN', undefined, LogLevel.WARN],
    ['info', undefined, LogLevel.INFO],
    ['debug', undefined, LogLevel.DEBUG],
    [undefined, 'production', LogLevel.INFO],
    [undefined, undefined, LogLevel.WARN],
    ['nonsense', 'development', LogLevel.WARN],
  ])('(%p, %p) -> %p', (value, env, expected) => {
    expect(parseLogLevel(value, env)).toBe(expected);
  });
});

describe('serializeError', () => {
  it('serializes Error instances without the stack', () => {
    expect(serializeError(new TypeError('bad'))).toEqual({ name: 'TypeError', message: 'bad' });
  });
  it('stringifies non-errors', () => {
    expect(serializeError(42)).toEqual({ error: '42' });
  });
});

describe('Logger', () => {
  it('writes structured JSON lines and respects the level', () => {
    const lines: string[] = [];
    const logger = new Logger('svc', { level: LogLevel.INFO, sink: (l) => lines.push(l) });
    logger.debug('hidden');
    logger.info('hello', { a: 1 });
    logger.warn('careful');
    logger.error('failed', new Error('boom'), { b: 2 });
    logger.error('no error object');

    expect(lines).toHaveLength(4);
    const parsed = lines.map((l) => JSON.parse(l));
    expect(parsed[0]).toMatchObject({ service: 'svc', level: 'INFO', message: 'hello', context: { a: 1 } });
    expect(parsed[1]).toMatchObject({ level: 'WARN', message: 'careful' });
    expect(parsed[1].context).toBeUndefined();
    expect(parsed[2]).toMatchObject({ level: 'ERROR', error: { message: 'boom' }, context: { b: 2 } });
    expect(parsed[3].error).toBeUndefined();
  });

  it('logs debug messages at DEBUG level', () => {
    const lines: string[] = [];
    new Logger('svc', { level: LogLevel.DEBUG, sink: (l) => lines.push(l) }).debug('visible');
    expect(lines).toHaveLength(1);
  });

  it('writes to stderr, never stdout, by default', () => {
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const logger = createLogger('svc');
      expect(logger.level).toBe(parseLogLevel(process.env.LOG_LEVEL, process.env.NODE_ENV));
      logger.error('to stderr');
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining('"to stderr"'));
      expect(stdout).not.toHaveBeenCalled();
    } finally {
      stderr.mockRestore();
      stdout.mockRestore();
    }
  });
});
