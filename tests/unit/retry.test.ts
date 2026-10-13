import { describe, expect, it, vi } from 'vitest';
import { errorStatus, isRetryableError, sleep, withRetry } from '../../src/utils/retry.js';

const httpError = (status: number) => ({ response: { status } });
const networkError = { request: {} };

describe('errorStatus', () => {
  it('extracts the HTTP status', () => {
    expect(errorStatus(httpError(404))).toBe(404);
    expect(errorStatus(networkError)).toBeUndefined();
    expect(errorStatus(null)).toBeUndefined();
    expect(errorStatus('x')).toBeUndefined();
  });
});

describe('isRetryableError', () => {
  it('retries rate limiting for every method', () => {
    expect(isRetryableError(httpError(429), 'POST')).toBe(true);
    expect(isRetryableError(httpError(429))).toBe(true);
  });

  it('retries network errors and 5xx/408 only for idempotent methods', () => {
    expect(isRetryableError(networkError, 'get')).toBe(true);
    expect(isRetryableError(httpError(503), 'GET')).toBe(true);
    expect(isRetryableError(httpError(408), 'GET')).toBe(true);
    expect(isRetryableError(networkError, 'POST')).toBe(false);
    expect(isRetryableError(httpError(503), 'PATCH')).toBe(false);
  });

  it('does not retry client errors or unknown values', () => {
    expect(isRetryableError(httpError(400), 'GET')).toBe(false);
    expect(isRetryableError({ response: {} }, 'GET')).toBe(false);
    expect(isRetryableError({}, 'GET')).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns the first successful result', async () => {
    await expect(withRetry(async () => 'ok')).resolves.toBe('ok');
  });

  it('retries with exponential backoff and jitter', async () => {
    const delays: number[] = [];
    const onRetry = vi.fn();
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw httpError(503);
        return 'done';
      },
      { initialDelayMs: 100, sleep: async (ms) => { delays.push(ms); }, random: () => 1, onRetry },
    );
    expect(result).toBe('done');
    expect(delays).toEqual([100, 200]);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('caps the delay and gives up after maxRetries', async () => {
    const delays: number[] = [];
    const fn = vi.fn().mockRejectedValue(httpError(500));
    await expect(
      withRetry(fn, { maxRetries: 2, initialDelayMs: 1000, maxDelayMs: 1500, sleep: async (ms) => { delays.push(ms); }, random: () => 0 }),
    ).rejects.toEqual(httpError(500));
    expect(fn).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([500, 750]);
  });

  it('does not retry when shouldRetry rejects the error', async () => {
    const fn = vi.fn().mockRejectedValue(httpError(400));
    await expect(withRetry(fn, { sleep: async () => {} })).rejects.toEqual(httpError(400));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses real timers by default', async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const promise = withRetry(async () => {
        if (calls++ === 0) throw httpError(503);
        return 'late';
      });
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toBe('late');
      const slept = sleep(10);
      await vi.advanceTimersByTimeAsync(10);
      await expect(slept).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
