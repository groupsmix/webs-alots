/**
 * SMS Integration via Twilio
 *
 * Sends plain SMS messages using the Twilio Programmable SMS API.
 * Reuses the same Twilio credentials as the WhatsApp integration
 * but sends via the standard SMS channel (no "whatsapp:" prefix).
 */

import { logger } from "@/lib/logger";

const TWILIO_API_URL = "https://api.twilio.com/2010-04-01";

interface TwilioSmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function getSmsConfig(): TwilioSmsConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_SMS_FROM || process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    return null;
  }

  return { accountSid, authToken, fromNumber };
}

/**
 * Send an SMS message via Twilio Programmable SMS API.
 */
export async function sendSms(to: string, body: string): Promise<SmsSendResult> {
  const config = getSmsConfig();

  if (!config) {
    // Twilio SMS credentials not configured
    return { success: false, error: "Twilio SMS not configured" };
  }

  try {
    const url = `${TWILIO_API_URL}/Accounts/${config.accountSid}/Messages.json`;
    const auth = btoa(`${config.accountSid}:${config.authToken}`);

    const formData = new URLSearchParams();
    formData.append("From", config.fromNumber);
    formData.append("To", to);
    formData.append("Body", body);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, messageId: data.sid };
    }

    return {
      success: false,
      error: data.message || "Failed to send SMS via Twilio",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("SMS send failed", { context: "sms", error: err });
    return { success: false, error: message };
  }
}
