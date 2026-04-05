/**
 * Pricing System Integration
 * 
 * Updates service pricing and creates promotions.
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';
import { logAuditEvent } from '@/lib/audit-log';

// ========== Update Service Pricing ==========

export async function updateServicePrice(
  businessId: string,
  serviceId: string,
  newPrice: number,
  reason?: string
): Promise<{ success: boolean; error?: string; original_price?: number }> {
  try {
    const supabase = await createTenantClient(businessId);

    // Get current price
    const { data: service, error: fetchError } = await supabase
      .from('services')
      .select('price, name')
      .eq('id', serviceId)
      .eq('clinic_id', businessId)
      .single();

    if (fetchError || !service) {
      return { success: false, error: 'Service not found' };
    }

    const originalPrice = service.price;

    // Validate price change (max 50% change)
    const changePercent = Math.abs((newPrice - originalPrice) / originalPrice) * 100;
    if (changePercent > 50) {
      return {
        success: false,
        error: `Price change too large (${changePercent.toFixed(0)}%). Maximum allowed: 50%`,
      };
    }

    // Update price
    const { error: updateError } = await supabase
      .from('services')
      .update({
        price: newPrice,
        updated_at: new Date().toISOString(),
        price_updated_at: new Date().toISOString(),
        price_update_reason: reason,
      })
      .eq('id', serviceId)
      .eq('clinic_id', businessId);

    if (updateError) {
      logger.error('Failed to update service price', {
        context: 'pricing-integration',
        error: updateError,
      });
      return { success: false, error: updateError.message };
    }

    // Log price history
    await supabase
      .from('price_history')
      .insert({
        clinic_id: businessId,
        service_id: serviceId,
        old_price: originalPrice,
        new_price: newPrice,
        change_percent: ((newPrice - originalPrice) / originalPrice) * 100,
        reason,
        changed_by: 'ai_agent',
        changed_at: new Date().toISOString(),
      });

    // Log audit event
    await logAuditEvent({
      action: 'service.price_updated',
      type: 'pricing',
      clinicId: businessId,
      actor: 'ai_agent',
      description: `AI updated price for ${service.name} from ${originalPrice} to ${newPrice}`,
      metadata: {
        service_id: serviceId,
        service_name: service.name,
        original_price: originalPrice,
        new_price: newPrice,
        change_percent: ((newPrice - originalPrice) / originalPrice) * 100,
        reason,
      },
    });

    logger.info('Service price updated', {
      context: 'pricing-integration',
      serviceId,
      originalPrice,
      newPrice,
    });

    return {
      success: true,
      original_price: originalPrice,
    };
  } catch (error) {
    logger.error('Failed to update service price', {
      context: 'pricing-integration',
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== Create Promotion ==========

export async function createPromotion(
  businessId: string,
  params: {
    name: string;
    description?: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    valid_from: string;
    valid_until: string;
    service_ids?: string[];
    min_purchase?: number;
    max_uses?: number;
    code?: string;
  }
): Promise<{ success: boolean; promotion_id?: string; error?: string }> {
  try {
    const supabase = await createTenantClient(businessId);

    // Validate discount
    if (params.discount_type === 'percentage' && params.discount_value > 100) {
      return { success: false, error: 'Discount percentage cannot exceed 100%' };
    }

    if (params.discount_type === 'percentage' && params.discount_value > 50) {
      return { success: false, error: 'AI cannot create discounts over 50%' };
    }

    // Generate promo code if not provided
    const code = params.code || generatePromoCode();

    // Check if code already exists
    const { data: existing } = await supabase
      .from('promotions')
      .select('id')
      .eq('clinic_id', businessId)
      .eq('code', code)
      .eq('is_active', true)
      .single();

    if (existing) {
      return { success: false, error: 'Promotion code already exists' };
    }

    // Create promotion
    const { data, error } = await supabase
      .from('promotions')
      .insert({
        clinic_id: businessId,
        name: params.name,
        description: params.description,
        code,
        discount_type: params.discount_type,
        discount_value: params.discount_value,
        valid_from: params.valid_from,
        valid_until: params.valid_until,
        service_ids: params.service_ids,
        min_purchase: params.min_purchase,
        max_uses: params.max_uses,
        current_uses: 0,
        is_active: true,
        created_by: 'ai_agent',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create promotion', {
        context: 'pricing-integration',
        error,
      });
      return { success: false, error: error.message };
    }

    // Log audit event
    await logAuditEvent({
      action: 'promotion.created',
      type: 'pricing',
      clinicId: businessId,
      actor: 'ai_agent',
      description: `AI created promotion: ${params.name} (${code})`,
      metadata: {
        promotion_id: data.id,
        name: params.name,
        code,
        discount_type: params.discount_type,
        discount_value: params.discount_value,
        valid_until: params.valid_until,
      },
    });

    logger.info('Promotion created', {
      context: 'pricing-integration',
      promotionId: data.id,
      code,
    });

    return {
      success: true,
      promotion_id: data.id,
    };
  } catch (error) {
    logger.error('Failed to create promotion', {
      context: 'pricing-integration',
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== Deactivate Promotion ==========

export async function deactivatePromotion(
  businessId: string,
  promotionId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createTenantClient(businessId);

    const { error } = await supabase
      .from('promotions')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', promotionId)
      .eq('clinic_id', businessId);

    if (error) {
      logger.error('Failed to deactivate promotion', {
        context: 'pricing-integration',
        error,
      });
      return { success: false, error: error.message };
    }

    // Log audit event
    await logAuditEvent({
      action: 'promotion.deactivated',
      type: 'pricing',
      clinicId: businessId,
      actor: 'ai_agent',
      description: `AI deactivated promotion ${promotionId}`,
      metadata: {
        promotion_id: promotionId,
        reason,
      },
    });

    logger.info('Promotion deactivated', {
      context: 'pricing-integration',
      promotionId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to deactivate promotion', {
      context: 'pricing-integration',
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== Get Active Promotions ==========

export async function getActivePromotions(
  businessId: string
): Promise<{ success: boolean; promotions?: any[]; error?: string }> {
  try {
    const supabase = await createTenantClient(businessId);

    const now = new Date().toISOString();

    const { data: promotions, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('clinic_id', businessId)
      .eq('is_active', true)
      .lte('valid_from', now)
      .gte('valid_until', now)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get active promotions', {
        context: 'pricing-integration',
        error,
      });
      return { success: false, error: error.message };
    }

    return {
      success: true,
      promotions: promotions || [],
    };
  } catch (error) {
    logger.error('Failed to get active promotions', {
      context: 'pricing-integration',
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== Helper Functions ==========

/**
 * Generate random promo code
 */
function generatePromoCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Calculate discount amount
 */
export function calculateDiscount(
  price: number,
  discountType: 'percentage' | 'fixed',
  discountValue: number
): number {
  if (discountType === 'percentage') {
    return Math.round(price * (discountValue / 100));
  }
  return Math.min(discountValue, price);
}

/**
 * Apply promotion to price
 */
export function applyPromotion(
  price: number,
  promotion: {
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    min_purchase?: number;
  }
): { final_price: number; discount: number; applicable: boolean } {
  // Check minimum purchase
  if (promotion.min_purchase && price < promotion.min_purchase) {
    return {
      final_price: price,
      discount: 0,
      applicable: false,
    };
  }

  const discount = calculateDiscount(price, promotion.discount_type, promotion.discount_value);
  const finalPrice = Math.max(0, price - discount);

  return {
    final_price: finalPrice,
    discount,
    applicable: true,
  };
}
