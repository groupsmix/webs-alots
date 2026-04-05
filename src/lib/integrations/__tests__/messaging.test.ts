/**
 * Messaging Integration Tests
 * 
 * Tests for WhatsApp, SMS, and Email integrations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  sendWhatsAppMessage, 
  sendSMS, 
  sendEmail,
  formatPhoneNumber,
  isValidEmail,
  isValidPhone
} from '../messaging';

// Mock fetch globally
global.fetch = vi.fn();

describe('Messaging Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WhatsApp Integration', () => {
    it('should send WhatsApp message via Meta Cloud API', async () => {
      process.env.WHATSAPP_PROVIDER = 'meta';
      process.env.META_WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
      process.env.META_WHATSAPP_ACCESS_TOKEN = 'test-token';

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg-123' }] }),
      });

      const result = await sendWhatsAppMessage('+212600000000', 'Test message', 'business-123');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should handle WhatsApp API errors', async () => {
      process.env.WHATSAPP_PROVIDER = 'meta';
      process.env.META_WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
      process.env.META_WHATSAPP_ACCESS_TOKEN = 'test-token';

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Invalid phone number' } }),
      });

      const result = await sendWhatsAppMessage('+212600000000', 'Test message', 'business-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number');
    });
  });

  describe('SMS Integration', () => {
    it('should send SMS via Twilio', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'test-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-token';
      process.env.TWILIO_PHONE_NUMBER = '+1234567890';

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'sms-123' }),
      });

      const result = await sendSMS('+212600000000', 'Test SMS', 'business-123');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('sms-123');
    });
  });

  describe('Email Integration', () => {
    it('should send email via Resend', async () => {
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 'test-key';
      process.env.RESEND_FROM_EMAIL = 'test@example.com';

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-123' }),
      });

      const result = await sendEmail(
        'recipient@example.com',
        'Test Subject',
        '<p>Test HTML</p>',
        'Test Text',
        'business-123'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('email-123');
    });
  });

  describe('Helper Functions', () => {
    it('should format phone numbers correctly', () => {
      expect(formatPhoneNumber('0600000000')).toBe('+212600000000');
      expect(formatPhoneNumber('+212600000000')).toBe('+212600000000');
      expect(formatPhoneNumber('600000000')).toBe('+212600000000');
    });

    it('should validate email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });

    it('should validate phone numbers', () => {
      expect(isValidPhone('+212600000000')).toBe(true);
      expect(isValidPhone('0600000000')).toBe(true);
      expect(isValidPhone('123')).toBe(false);
    });
  });
});
