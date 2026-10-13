/**
 * Retry helper with exponential backoff and jitter.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ErrorShape {
  response?: { status?: number; headers?: Record<string, unknown> };
  request?: unknown;
}

/** HTTP status of an axios-style error, if any. */
export function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  return (error as ErrorShape).response?.status;
}

/**
 * Whether a failed request can safely be retried.
 *
 * Rate-limited requests (429) were rejected before being processed, so they are retried for any
 * method. Network errors and 5xx responses are only retried for idempotent methods, because a
 * non-idempotent call (e.g. adding consumptions) may already have been applied.
 */
export function isRetryableError(error: unknown, method: string = 'GET'): boolean {
  if (!error || typeof error !== 'object') return false;
  const { response, request } = error as ErrorShape;
  const status = response?.status;
  if (status === 429) return true;

  const idempotent = ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  if (!idempotent) return false;
  if (!response) return request !== undefined;
  return status !== undefined && (status >= 500 || status === 408);
}

/** Execute `fn`, retrying failures accepted by `shouldRetry` with exponential backoff. */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxRetries = 2,
    initialDelayMs = 500,
    maxDelayMs = 10_000,
    backoffMultiplier = 2,
    shouldRetry = (error: unknown) => isRetryableError(error),
    onRetry,
    sleep: wait = sleep,
    random = Math.random,
  } = options;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxRetries || !shouldRetry(error, attempt)) throw error;
      const base = Math.min(initialDelayMs * Math.pow(backoffMultiplier, attempt), maxDelayMs);
      const delay = Math.round(base * (0.5 + random() * 0.5));
      onRetry?.(attempt + 1, error, delay);
      await wait(delay);
    }
  }
}
