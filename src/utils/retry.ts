/**
 * Retry with exponential backoff and jitter.
 *
 * Only used for idempotent requests (GET). License API calls such as
 * add_consumption are not idempotent, so they are never retried.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { response?: { status?: number }; request?: unknown };
  if (!err.response) return err.request !== undefined;
  const status = err.response.status;
  if (status === undefined) return false;
  return status >= 500 || status === 429 || status === 408;
}

export const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelay = options.initialDelay ?? 500;
  const maxDelay = options.maxDelay ?? 10_000;
  const multiplier = options.backoffMultiplier ?? 2;
  const shouldRetry = options.shouldRetry ?? isRetryableError;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxRetries || !shouldRetry(error)) throw error;
      const base = Math.min(initialDelay * multiplier ** attempt, maxDelay);
      const delay = base * (0.5 + random() * 0.5);
      options.onRetry?.(attempt + 1, error, delay);
      await sleep(delay);
    }
  }
}
