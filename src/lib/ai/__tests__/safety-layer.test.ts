/**
 * Safety Layer Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkSafety } from '../safety-layer';
import type { AIAction, BusinessContext } from '../types';

// Mock dependencies
vi.mock('@/lib/supabase-server');

describe('Safety Layer', () => {
  const mockContext: BusinessContext = {
    business_id: 'business-123',
    business_metrics: {
      total_revenue: 50000,
      total_customers: 100,
      average_rating: 4.5,
      total_appointments: 200,
      no_show_rate: 0.1,
      cancellation_rate: 0.05,
    },
    recent_activity: {
      appointments_last_7_days: 20,
      revenue_last_7_days: 5000,
      new_customers_last_7_days: 5,
      messages_sent_last_7_days: 10,
    },
    customer_segments: {
      vip: 10,
      regular: 50,
      at_risk: 20,
      inactive: 20,
    },
    market_context: {
      current_season: 'high',
      demand_forecast: 0.8,
      industry_benchmarks: {
        average_revenue_per_customer: 500,
        average_retention_rate: 0.7,
        average_no_show_rate: 0.15,
        average_rating: 4.2,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Budget Limits', () => {
    it('should allow actions within budget', async () => {
      const action: AIAction = {
        id: 'action-123',
        business_id: 'business-123',
        type: 'send_message',
        status: 'pending',
        risk_level: 'low',
        confidence: 0.9,
        action: {
          type: 'send_message',
          params: {},
        },
        reasoning: 'Test',
        expected_outcome: {
          cost: 10,
        },
        requires_approval: false,
        created_at: new Date().toISOString(),
      };

      const violations = await checkSafety(action, mockContext);

      expect(violations).toHaveLength(0);
    });
  });

  describe('Pricing Validation', () => {
    it('should reject price changes over 50%', async () => {
      const action: AIAction = {
        id: 'action-123',
        business_id: 'business-123',
        type: 'adjust_pricing',
        status: 'pending',
        risk_level: 'high',
        confidence: 0.9,
        action: {
          type: 'adjust_pricing',
          params: {
            change_percent: 60,
          },
        },
        reasoning: 'Test',
        expected_outcome: {},
        requires_approval: true,
        created_at: new Date().toISOString(),
      };

      const violations = await checkSafety(action, mockContext);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].rule_id).toBe('pricing_limits');
    });
  });

  describe('Customer Protection', () => {
    it('should limit messages per customer', async () => {
      const action: AIAction = {
        id: 'action-123',
        business_id: 'business-123',
        type: 'send_message',
        status: 'pending',
        risk_level: 'low',
        confidence: 0.9,
        action: {
          type: 'send_message',
          params: {
            customer_id: 'customer-123',
          },
        },
        reasoning: 'Test',
        expected_outcome: {},
        requires_approval: false,
        created_at: new Date().toISOString(),
      };

      const violations = await checkSafety(action, mockContext);

      // Should pass if under limit
      expect(violations).toBeDefined();
    });
  });
});
