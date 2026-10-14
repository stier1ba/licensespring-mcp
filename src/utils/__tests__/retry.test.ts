import { jest } from '@jest/globals';
import { defaultSleep, isRetryableError, withRetry } from '../retry.js';

const noSleep = () => Promise.resolve();
const httpError = (status: number) => ({ response: { status } });

describe('isRetryableError', () => {
  it.each([
    [undefined, false],
    ['string', false],
    [{ request: {} }, true],
    [{}, false],
    [{ response: {} }, false],
    [httpError(500), true],
    [httpError(503), true],
    [httpError(429), true],
    [httpError(408), true],
    [httpError(400), false],
    [httpError(404), false],
  ])('%p -> %p', (error, expected) => {
    expect(isRetryableError(error)).toBe(expected);
  });
});

describe('withRetry', () => {
  it('works with no options', async () => {
    await expect(withRetry(async () => 7)).resolves.toBe(7);
  });

  it('returns the first successful result without retrying', async () => {
    const fn = jest.fn(async () => 'ok');
    await expect(withRetry(fn, { sleep: noSleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries retryable errors with exponential backoff and jitter', async () => {
    const delays: number[] = [];
    const onRetry = jest.fn();
    const fn = jest.fn<() => Promise<string>>()
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValue('done');
    const result = await withRetry(fn, {
      initialDelay: 100,
      backoffMultiplier: 2,
      random: () => 1,
      sleep: async (ms) => { delays.push(ms); },
      onRetry,
    });
    expect(result).toBe('done');
    expect(delays).toEqual([100, 200]);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, httpError(503), 100);
  });

  it('caps the delay at maxDelay', async () => {
    const delays: number[] = [];
    const fn = jest.fn<() => Promise<string>>().mockRejectedValueOnce(httpError(500)).mockResolvedValue('x');
    await withRetry(fn, { initialDelay: 1000, maxDelay: 300, random: () => 0, sleep: async (ms) => { delays.push(ms); } });
    expect(delays).toEqual([150]);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = jest.fn(async () => { throw httpError(400); });
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toEqual(httpError(400));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxRetries', async () => {
    const fn = jest.fn(async () => { throw httpError(502); });
    await expect(withRetry(fn, { maxRetries: 2, sleep: noSleep })).rejects.toEqual(httpError(502));
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('honours a custom shouldRetry', async () => {
    const fn = jest.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('ok');
    await expect(withRetry(fn, { shouldRetry: () => true, sleep: noSleep })).resolves.toBe('ok');
  });

  it('uses the real sleep and Math.random by default', async () => {
    const fn = jest.fn<() => Promise<string>>().mockRejectedValueOnce(httpError(500)).mockResolvedValue('ok');
    await expect(withRetry(fn, { initialDelay: 1 })).resolves.toBe('ok');
  });
});

describe('defaultSleep', () => {
  it('resolves after the delay', async () => {
    jest.useFakeTimers();
    const done = jest.fn();
    const promise = defaultSleep(1000).then(done);
    await jest.advanceTimersByTimeAsync(999);
    expect(done).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await promise;
    expect(done).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
