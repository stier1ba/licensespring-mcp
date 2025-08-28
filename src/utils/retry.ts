/**
 * Retry utility with exponential backoff for API calls
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableErrors: (error: unknown) => {
    // Retry on network errors and 5xx status codes
    const axiosError = error as { response?: { status?: number } };
    if (!axiosError.response) return true; // Network error
    const status = axiosError.response?.status;
    return (status !== undefined && (status >= 500 || status === 429)); // Server errors or rate limiting
  },
  onRetry: () => {} // Default no-op
};

/**
 * Execute a function with exponential backoff retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt === opts.maxRetries || !opts.retryableErrors(error)) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      );
      
      // Add jitter to prevent thundering herd
      const jitteredDelay = delay * (0.5 + Math.random() * 0.5);
      
      // Notify about retry
      opts.onRetry(attempt + 1, error, jitteredDelay);
      
      // Wait before retrying
      await sleep(jitteredDelay);
    }
  }
  
  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a retry wrapper with preset options
 */
export function createRetryWrapper(defaultOptions: RetryOptions) {
  return <T>(fn: () => Promise<T>, overrideOptions?: RetryOptions): Promise<T> => {
    return withRetry(fn, { ...defaultOptions, ...overrideOptions });
  };
}

/**
 * Check if an error is retryable based on common patterns
 */
export function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  
  const axiosError = error as { response?: { status?: number }, request?: unknown };
  
  // Network errors are always retryable
  if (!axiosError.response && axiosError.request) {
    return true;
  }
  
  // Check HTTP status codes
  const status = axiosError.response?.status;
  if (!status) return false;
  
  // Retry on server errors and rate limiting
  if (status >= 500 || status === 429) return true;
  
  // Retry on specific client errors that might be transient
  if (status === 408 || status === 409 || status === 423 || status === 425) {
    return true;
  }
  
  return false;
}

export default withRetry;