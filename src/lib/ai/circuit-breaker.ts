/**
 * Circuit Breaker Pattern
 * 
 * Prevents cascading failures by stopping calls to failing services
 */

import { logger } from '@/lib/logger';

export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing, reject all requests
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold: number;      // Number of failures before opening
  successThreshold: number;      // Number of successes to close from half-open
  timeout: number;               // Milliseconds to wait before trying again
  resetTimeout: number;          // Milliseconds in open state before half-open
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 5000,
  resetTimeout: 60000, // 1 minute
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = Date.now();
  private options: CircuitBreakerOptions;
  
  constructor(
    private name: string,
    options: Partial<CircuitBreakerOptions> = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        logger.warn('Circuit breaker blocking request', {
          context: 'circuit-breaker',
          name: this.name,
          state: this.state,
          nextAttempt: new Date(this.nextAttempt).toISOString(),
        });
        throw error;
      }
      
      // Transition to half-open
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      logger.info('Circuit breaker transitioning to HALF_OPEN', {
        context: 'circuit-breaker',
        name: this.name,
      });
    }
    
    try {
      // Execute function with timeout
      const result = await this.executeWithTimeout(fn);
      
      // Record success
      this.onSuccess();
      
      return result;
    } catch (error) {
      // Record failure
      this.onFailure();
      
      throw error;
    }
  }
  
  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout after ${this.options.timeout}ms`)),
          this.options.timeout
        )
      ),
    ]);
  }
  
  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.options.successThreshold) {
        // Close circuit
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        
        logger.info('Circuit breaker CLOSED', {
          context: 'circuit-breaker',
          name: this.name,
        });
      }
    }
  }
  
  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Open circuit immediately on failure in half-open state
      this.openCircuit();
    } else if (this.failureCount >= this.options.failureThreshold) {
      // Open circuit after threshold failures
      this.openCircuit();
    }
  }
  
  /**
   * Open the circuit
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.options.resetTimeout;
    
    logger.error('Circuit breaker OPENED', {
      context: 'circuit-breaker',
      name: this.name,
      failureCount: this.failureCount,
      nextAttempt: new Date(this.nextAttempt).toISOString(),
    });
  }
  
  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.state === CircuitState.OPEN ? new Date(this.nextAttempt).toISOString() : null,
    };
  }
  
  /**
   * Manually reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    
    logger.info('Circuit breaker manually reset', {
      context: 'circuit-breaker',
      name: this.name,
    });
  }
}

// Global circuit breakers for integrations
export const circuitBreakers = {
  whatsapp: new CircuitBreaker('whatsapp', { failureThreshold: 3, resetTimeout: 30000 }),
  sms: new CircuitBreaker('sms', { failureThreshold: 3, resetTimeout: 30000 }),
  email: new CircuitBreaker('email', { failureThreshold: 5, resetTimeout: 60000 }),
  openai: new CircuitBreaker('openai', { failureThreshold: 3, resetTimeout: 60000 }),
  anthropic: new CircuitBreaker('anthropic', { failureThreshold: 3, resetTimeout: 60000 }),
};
