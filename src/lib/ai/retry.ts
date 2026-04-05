/**
 * Retry Logic with Exponential Backoff
 * 
 * Handles transient failures in external API calls
 */

import { logger } from '@/lib/logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  backoffMultiplier?: number;
  retryableErrors?: string[]; // Error messages that should trigger retry
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'network',
    'timeout',
    'rate limit',
    '429',
    '500',
    '502',
    '503',
    '504',
  ],
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if error is retryable
      const isRetryable = opts.retryableErrors.some(pattern =>
        lastError!.message.toLowerCase().includes(pattern.toLowerCase())
      );
      
      if (!isRetryable || attempt === opts.maxAttempts) {
        logger.error('Function failed after retries', {
          context: 'retry',
          attempt,
          maxAttempts: opts.maxAttempts,
          error: lastError,
        });
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay
      );
      
      logger.warn('Function failed, retrying', {
        context: 'retry',
        attempt,
        maxAttempts: opts.maxAttempts,
        delay,
        error: lastError.message,
      });
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Retry with jitter to prevent thundering herd
 */
export async function retryWithJitter<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      const isRetryable = opts.retryableErrors.some(pattern =>
        lastError!.message.toLowerCase().includes(pattern.toLowerCase())
      );
      
      if (!isRetryable || attempt === opts.maxAttempts) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff + jitter
      const baseDelay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay
      );
      
      // Add random jitter (0-50% of base delay)
      const jitter = Math.random() * baseDelay * 0.5;
      const delay = baseDelay + jitter;
      
      logger.warn('Function failed, retrying with jitter', {
        context: 'retry',
        attempt,
        delay: Math.round(delay),
        error: lastError.message,
      });
      
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrap a function to automatically retry on failure
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: any[]) => {
    return retryWithBackoff(() => fn(...args), options);
  }) as T;
}
