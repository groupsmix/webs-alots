/**
 * Pricing Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  updateServicePrice,
  createPromotion,
  deactivatePromotion,
  getActivePromotions,
  calculateDiscount,
  applyPromotion
} from '../pricing';

// Mock dependencies
vi.mock('@/lib/supabase-server', () => ({
  createTenantClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ 
              data: { price: 100, name: 'Test Service' }, 
              error: null 
            })),
            lte: vi.fn(() => ({
              gte: vi.fn(() => ({
                order: vi.fn(() => ({ data: [], error: null })),
              })),
            })),
          })),
          in: vi.fn(() => ({ error: null, count: 5 })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({ 
            data: { id: 'promo-123' }, 
            error: null 
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null })),
        })),
      })),
    })),
  })),
}));

vi.mock('@/lib/audit-log', () => ({
  logAuditEvent: vi.fn(),
}));

describe('Pricing Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateServicePrice', () => {
    it('should update price successfully', async () => {
      const result = await updateServicePrice(
        'business-123',
        'service-123',
        120,
        'Market adjustment'
      );

      expect(result.success).toBe(true);
      expect(result.original_price).toBe(100);
    });

    it('should reject price changes over 50%', async () => {
      const result = await updateServicePrice(
        'business-123',
        'service-123',
        200, // 100% increase
        'Too large'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });
  });

  describe('createPromotion', () => {
    it('should create promotion successfully', async () => {
      const result = await createPromotion('business-123', {
        name: 'Summer Sale',
        discount_type: 'percentage',
        discount_value: 20,
        valid_from: '2026-06-01T00:00:00Z',
        valid_until: '2026-08-31T23:59:59Z',
      });

      expect(result.success).toBe(true);
      expect(result.promotion_id).toBe('promo-123');
    });

    it('should reject discounts over 50%', async () => {
      const result = await createPromotion('business-123', {
        name: 'Too Much',
        discount_type: 'percentage',
        discount_value: 60,
        valid_from: '2026-06-01T00:00:00Z',
        valid_until: '2026-08-31T23:59:59Z',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('50%');
    });
  });

  describe('Helper Functions', () => {
    it('should calculate percentage discount correctly', () => {
      const discount = calculateDiscount(100, 'percentage', 20);
      expect(discount).toBe(20);
    });

    it('should calculate fixed discount correctly', () => {
      const discount = calculateDiscount(100, 'fixed', 30);
      expect(discount).toBe(30);
    });

    it('should apply promotion correctly', () => {
      const result = applyPromotion(100, {
        discount_type: 'percentage',
        discount_value: 20,
      });

      expect(result.final_price).toBe(80);
      expect(result.discount).toBe(20);
      expect(result.applicable).toBe(true);
    });

    it('should respect minimum purchase', () => {
      const result = applyPromotion(50, {
        discount_type: 'percentage',
        discount_value: 20,
        min_purchase: 100,
      });

      expect(result.applicable).toBe(false);
      expect(result.discount).toBe(0);
    });
  });
});
