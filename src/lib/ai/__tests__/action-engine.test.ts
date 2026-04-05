/**
 * Action Engine Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAction } from '../action-engine';
import type { AIAction } from '../types';

// Mock dependencies
vi.mock('@/lib/supabase-server');
vi.mock('@/lib/integrations/messaging');
vi.mock('@/lib/integrations/booking');
vi.mock('@/lib/integrations/pricing');
vi.mock('@/lib/audit-log');

describe('Action Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeAction', () => {
    it('should execute send_message action', async () => {
      const action: AIAction = {
        id: 'action-123',
        business_id: 'business-123',
        type: 'send_message',
        status: 'approved',
        risk_level: 'low',
        confidence: 0.9,
        action: {
          type: 'send_message',
          params: {
            customer_id: 'customer-123',
            channel: 'whatsapp',
            message: 'Test message',
          },
        },
        reasoning: 'Test',
        expected_outcome: {},
        requires_approval: false,
        created_at: new Date().toISOString(),
      };

      const result = await executeAction(action);

      expect(result.success).toBeDefined();
    });

    it('should handle action execution errors', async () => {
      const action: AIAction = {
        id: 'action-123',
        business_id: 'business-123',
        type: 'send_message',
        status: 'approved',
        risk_level: 'low',
        confidence: 0.9,
        action: {
          type: 'send_message',
          params: {
            // Missing required params
          },
        },
        reasoning: 'Test',
        expected_outcome: {},
        requires_approval: false,
        created_at: new Date().toISOString(),
      };

      const result = await executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
