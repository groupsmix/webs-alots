/**
 * Load Balancer
 * 
 * Distribute load across multiple LLM providers
 */

import { logger } from '@/lib/logger';

export interface Provider {
  name: string;
  weight: number;
  available: boolean;
  errorCount: number;
  lastError?: Date;
}

class LoadBalancer {
  private providers: Provider[] = [
    { name: 'openai', weight: 70, available: true, errorCount: 0 },
    { name: 'anthropic', weight: 30, available: true, errorCount: 0 },
  ];
  
  /**
   * Select provider based on weights and availability
   */
  selectProvider(): string {
    // Filter available providers
    const available = this.providers.filter(p => p.available && p.errorCount < 5);
    
    if (available.length === 0) {
      // Reset all if none available
      this.providers.forEach(p => {
        p.available = true;
        p.errorCount = 0;
      });
      return this.providers[0].name;
    }
    
    // Weighted random selection
    const totalWeight = available.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const provider of available) {
      random -= provider.weight;
      if (random <= 0) {
        logger.debug('Provider selected', {
          context: 'load-balancer',
          provider: provider.name,
          weight: provider.weight,
        });
        return provider.name;
      }
    }
    
    return available[0].name;
  }
  
  /**
   * Record provider success
   */
  recordSuccess(providerName: string): void {
    const provider = this.providers.find(p => p.name === providerName);
    if (provider) {
      provider.errorCount = Math.max(0, provider.errorCount - 1);
      provider.available = true;
    }
  }
  
  /**
   * Record provider error
   */
  recordError(providerName: string): void {
    const provider = this.providers.find(p => p.name === providerName);
    if (provider) {
      provider.errorCount++;
      provider.lastError = new Date();
      
      // Mark unavailable if too many errors
      if (provider.errorCount >= 5) {
        provider.available = false;
        logger.warn('Provider marked unavailable', {
          context: 'load-balancer',
          provider: providerName,
          errorCount: provider.errorCount,
        });
        
        // Auto-recover after 5 minutes
        setTimeout(() => {
          provider.available = true;
          provider.errorCount = 0;
          logger.info('Provider auto-recovered', {
            context: 'load-balancer',
            provider: providerName,
          });
        }, 5 * 60 * 1000);
      }
    }
  }
  
  /**
   * Get provider statistics
   */
  getStats() {
    return this.providers.map(p => ({
      name: p.name,
      weight: p.weight,
      available: p.available,
      errorCount: p.errorCount,
      lastError: p.lastError?.toISOString(),
    }));
  }
}

export const loadBalancer = new LoadBalancer();
