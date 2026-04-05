/**
 * Simple In-Memory Cache
 * 
 * Reduces database load by caching frequently accessed data
 */

import { logger } from '@/lib/logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class Cache {
  private store = new Map<string, CacheEntry<any>>();
  private hits = 0;
  private misses = 0;
  
  /**
   * Get value from cache or compute it
   */
  async get<T>(
    key: string,
    compute: () => Promise<T>,
    options: { ttl?: number } = {}
  ): Promise<T> {
    const ttl = options.ttl || 300000; // Default 5 minutes
    
    // Check cache
    const cached = this.store.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      this.hits++;
      logger.debug('Cache hit', {
        context: 'cache',
        key,
        hitRate: this.getHitRate(),
      });
      return cached.value;
    }
    
    // Cache miss - compute value
    this.misses++;
    logger.debug('Cache miss', {
      context: 'cache',
      key,
      hitRate: this.getHitRate(),
    });
    
    const value = await compute();
    
    // Store in cache
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
    
    return value;
  }
  
  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl: number = 300000): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }
  
  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.store.delete(key);
  }
  
  /**
   * Clear entire cache
   */
  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    
    logger.info('Cache cleared', {
      context: 'cache',
    });
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate(),
    };
  }
  
  /**
   * Get hit rate
   */
  private getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }
  
  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      logger.debug('Cache cleanup', {
        context: 'cache',
        removed,
        remaining: this.store.size,
      });
    }
  }
}

// Global cache instance
export const cache = new Cache();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => cache.cleanup(), 5 * 60 * 1000);
}
