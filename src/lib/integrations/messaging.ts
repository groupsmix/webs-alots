/**
 * Messaging Integration
 * 
 * Sends messages via WhatsApp, SMS, and Email.
 */

import { logger } from '@/lib/logger';
import { retryWithBackoff } from '@/lib/ai/retry';
import { trackIntegrationError } from '@/lib/monitoring';
import { circuitBreakers } from '@/lib/ai/circuit-breaker';

// ========== WhatsApp Integration ==========

/**
 * Send WhatsApp message via Meta Cloud API or Twilio
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string,
  businessId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    return await circuitBreakers.whatsapp.execute(() =>
      retryWithBackoff(
        () => sendWhatsAppMessageInternal(to, message, businessId),
        { maxAttempts: 3 }
      )
    );
  } catch (error) {
    trackIntegrationError('whatsapp', error as Error, { to, businessId });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function sendWhatsAppMessageInternal(
  to: string,
  message: string,
  businessId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Get WhatsApp config from environment or database
    const provider = process.env.WHATSAPP_PROVIDER || 'meta'; // 'meta' or 'twilio'

    if (provider === 'meta') {
      return await sendWhatsAppViaMeta(to, message, businessId);
    } else if (provider === 'twilio') {
      return await sendWhatsAppViaTwilio(to, message, businessId);
    }

    return { success: false, error: 'Invalid WhatsApp provider' };
  } catch (error) {
    logger.error('Failed to send WhatsApp message', {
      context: 'messaging',
      to,
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send via Meta Cloud API
 */
async function sendWhatsAppViaMeta(
  to: string,
  message: string,
  businessId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    logger.warn('Meta WhatsApp credentials not configured', {
      context: 'messaging',
    });
    return { success: false, error: 'WhatsApp not configured' };
  }

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''), // Remove non-digits
      type: 'text',
      text: { body: message },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error('Meta WhatsApp API error', {
      context: 'messaging',
      error: data,
    });
    return { success: false, error: data.error?.message || 'WhatsApp send failed' };
  }

  logger.info('WhatsApp message sent via Meta', {
    context: 'messaging',
    to,
    messageId: data.messages?.[0]?.id,
  });

  return {
    success: true,
    messageId: data.messages?.[0]?.id,
  };
}

/**
 * Send via Twilio
 */
async function sendWhatsAppViaTwilio(
  to: string,
  message: string,
  businessId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    logger.warn('Twilio credentials not configured', {
      context: 'messaging',
    });
    return { success: false, error: 'WhatsApp not configured' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: `whatsapp:${fromNumber}`,
      To: `whatsapp:${to}`,
      Body: message,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error('Twilio WhatsApp API error', {
      context: 'messaging',
      error: data,
    });
    return { success: false, error: data.message || 'WhatsApp send failed' };
  }

  logger.info('WhatsApp message sent via Twilio', {
    context: 'messaging',
    to,
    messageId: data.sid,
  });

  return {
    success: true,
    messageId: data.sid,
  };
}

// ========== SMS Integration ==========

/**
 * Send SMS via Twilio
 */
export async function sendSMS(
  to: string,
  message: string,
  businessId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      logger.warn('Twilio SMS credentials not configured', {
        context: 'messaging',
      });
      return { success: false, error: 'SMS not configured' };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: to,
        Body: message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error('Twilio SMS API error', {
        context: 'messaging',
        error: data,
      });
      return { success: false, error: data.message || 'SMS send failed' };
    }

    logger.info('SMS sent via Twilio', {
      context: 'messaging',
      to,
      messageId: data.sid,
    });

    return {
      success: true,
      messageId: data.sid,
    };
  } catch (error) {
    logger.error('Failed to send SMS', {
      context: 'messaging',
      to,
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== Email Integration ==========

/**
 * Send Email via Resend or SMTP
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  businessId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const provider = process.env.EMAIL_PROVIDER || 'resend'; // 'resend' or 'smtp'

    if (provider === 'resend') {
      return await sendEmailViaResend(to, subject, html, text, businessId);
    } else if (provider === 'smtp') {
      return await sendEmailViaSMTP(to, subject, html, text, businessId);
    }

    return { success: false, error: 'Invalid email provider' };
  } catch (error) {
    logger.error('Failed to send email', {
      context: 'messaging',
      to,
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send via Resend
 */
async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string,
  businessId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@oltigo.com';

  if (!apiKey) {
    logger.warn('Resend API key not configured', {
      context: 'messaging',
    });
    return { success: false, error: 'Email not configured' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error('Resend API error', {
      context: 'messaging',
      error: data,
    });
    return { success: false, error: data.message || 'Email send failed' };
  }

  logger.info('Email sent via Resend', {
    context: 'messaging',
    to,
    messageId: data.id,
  });

  return {
    success: true,
    messageId: data.id,
  };
}

/**
 * Send via SMTP (using nodemailer)
 */
async function sendEmailViaSMTP(
  to: string,
  subject: string,
  html: string,
  text: string,
  businessId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Note: This requires nodemailer package
  // npm install nodemailer @types/nodemailer
  
  const nodemailer = await import('nodemailer');

  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@oltigo.com',
    to,
    subject,
    text,
    html,
  });

  logger.info('Email sent via SMTP', {
    context: 'messaging',
    to,
    messageId: info.messageId,
  });

  return {
    success: true,
    messageId: info.messageId,
  };
}

// ========== Helper Functions ==========

/**
 * Format phone number for international use
 */
export function formatPhoneNumber(phone: string, countryCode: string = '+212'): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // If starts with country code, return as is
  if (digits.startsWith(countryCode.replace('+', ''))) {
    return `+${digits}`;
  }
  
  // If starts with 0, replace with country code
  if (digits.startsWith('0')) {
    return `${countryCode}${digits.substring(1)}`;
  }
  
  // Otherwise, prepend country code
  return `${countryCode}${digits}`;
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number
 */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}
