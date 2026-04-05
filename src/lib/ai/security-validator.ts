/**
 * Security Validator
 * 
 * Additional security checks for AI actions
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';
import type { AIAction } from './types';

export interface SecurityCheck {
  passed: boolean;
  violations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Validate action security
 */
export async function validateActionSecurity(
  action: AIAction,
  businessId: string
): Promise<SecurityCheck> {
  const violations: string[] = [];
  let severity: SecurityCheck['severity'] = 'low';
  
  // Check 1: SQL injection in params
  if (hasSQLInjection(action.action.params)) {
    violations.push('Potential SQL injection detected in parameters');
    severity = 'critical';
  }
  
  // Check 2: XSS in message content
  if (action.type === 'send_message' && hasXSS(action.action.params.message)) {
    violations.push('Potential XSS detected in message content');
    severity = 'high';
  }
  
  // Check 3: Excessive data access
  if (await hasExcessiveDataAccess(action, businessId)) {
    violations.push('Action attempts to access excessive customer data');
    severity = 'high';
  }
  
  // Check 4: Suspicious patterns
  if (hasSuspiciousPatterns(action)) {
    violations.push('Suspicious patterns detected in action');
    severity = 'medium';
  }
  
  // Check 5: Rate limit bypass attempt
  if (await isRateLimitBypass(action, businessId)) {
    violations.push('Potential rate limit bypass detected');
    severity = 'high';
  }
  
  const passed = violations.length === 0;
  
  if (!passed) {
    logger.warn('Security validation failed', {
      context: 'security-validator',
      actionId: action.id,
      violations,
      severity,
    });
  }
  
  return { passed, violations, severity };
}

/**
 * Check for SQL injection patterns
 */
function hasSQLInjection(params: Record<string, any>): boolean {
  const sqlPatterns = [
    /(\bOR\b|\bAND\b).*=.*=/i,
    /UNION.*SELECT/i,
    /DROP.*TABLE/i,
    /INSERT.*INTO/i,
    /DELETE.*FROM/i,
    /--/,
    /;.*DROP/i,
  ];
  
  const str = JSON.stringify(params);
  return sqlPatterns.some(pattern => pattern.test(str));
}

/**
 * Check for XSS patterns
 */
function hasXSS(content: string): boolean {
  if (!content) return false;
  
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onload=/i,
    /<iframe/i,
  ];
  
  return xssPatterns.some(pattern => pattern.test(content));
}

/**
 * Check for excessive data access
 */
async function hasExcessiveDataAccess(action: AIAction, businessId: string): Promise<boolean> {
  // Check if action tries to access all customers
  if (action.action.params.segment === 'all' && !action.action.params.limit) {
    return true;
  }
  
  // Check if action has no filters
  if (action.type === 'send_message' && !action.action.params.customer_id && !action.action.params.segment) {
    return true;
  }
  
  return false;
}

/**
 * Check for suspicious patterns
 */
function hasSuspiciousPatterns(action: AIAction): boolean {
  const params = JSON.stringify(action.action.params);
  
  // Check for encoded payloads
  if (params.includes('base64') || params.includes('eval')) {
    return true;
  }
  
  // Check for unusual characters
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(params)) {
    return true;
  }
  
  return false;
}

/**
 * Check for rate limit bypass attempts
 */
async function isRateLimitBypass(action: AIAction, businessId: string): Promise<boolean> {
  const supabase = await createTenantClient(businessId);
  
  // Check for rapid action creation (>10 in last minute)
  const oneMinuteAgo = new Date(Date.now() - 60000);
  
  const { count } = await supabase
    .from('ai_actions')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', oneMinuteAgo.toISOString());
  
  return (count || 0) > 10;
}

/**
 * Sanitize message content
 */
export function sanitizeMessage(message: string): string {
  return message
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone: string): boolean {
  // Moroccan phone format: +212XXXXXXXXX
  const moroccanPattern = /^\+212[5-7]\d{8}$/;
  return moroccanPattern.test(phone);
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}
