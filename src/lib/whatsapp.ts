/**
 * WhatsApp Business API Integration
 *
 * Supports both Meta WhatsApp Business API (direct) and Twilio WhatsApp API.
 * Integrates with the notification engine for template-based messaging.
 */

import {
  substituteVariables,
  type NotificationTrigger,
  type TemplateVariables,
  type NotificationTemplate,
  defaultNotificationTemplates,
} from "./notifications";
import { toDarijaNotificationTemplates } from "./whatsapp-templates-darija";

/**
 * Supported locales for patient-facing WhatsApp messages.
 * - `fr`     – French / formal (default, uses `defaultNotificationTemplates`)
 * - `ar`     – Arabic (same as default for now, can be extended)
 * - `darija` – Moroccan Arabic (uses Darija-specific templates)
 */
export type PatientMessageLocale = "fr" | "ar" | "darija";

// ---- Types ----

type WhatsAppProvider = "meta" | "twilio";

interface WhatsAppConfig {
  provider: WhatsAppProvider;
  // Meta WhatsApp Business API
  metaPhoneNumberId?: string;
  metaAccessToken?: string;
  // Twilio WhatsApp API
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  // Shared
  verifyToken?: string;
}

interface WhatsAppMessagePayload {
  to: string;
  templateName: string;
  languageCode?: string;
  parameters?: string[];
}

interface QuickReplyButton {
  id: string;
  title: string;
}

interface WhatsAppInteractivePayload {
  to: string;
  body: string;
  buttons: QuickReplyButton[];
  header?: string;
  footer?: string;
}

interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: WhatsAppProvider;
}

export type WhatsAppMessageStatus = "sent" | "delivered" | "read" | "failed";

export interface WhatsAppStatusUpdate {
  messageId: string;
  status: WhatsAppMessageStatus;
  timestamp: string;
  recipientPhone: string;
  errors?: Array<{ code: number; title: string }>;
}

const META_API_URL = "https://graph.facebook.com/v21.0";
const TWILIO_API_URL = "https://api.twilio.com/2010-04-01";

// ---- Configuration ----

function getWhatsAppConfig(): WhatsAppConfig {
  const provider = (process.env.WHATSAPP_PROVIDER || "meta") as WhatsAppProvider;
  return {
    provider,
    metaPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    metaAccessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFromNumber: process.env.TWILIO_WHATSAPP_FROM,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  };
}

function isConfigured(config: WhatsAppConfig): boolean {
  if (config.provider === "twilio") {
    return !!(config.twilioAccountSid && config.twilioAuthToken && config.twilioFromNumber);
  }
  return !!(config.metaPhoneNumberId && config.metaAccessToken);
}

// ---- Meta WhatsApp Business API ----

async function sendViaMeta(
  config: WhatsAppConfig,
  to: string,
  body: string,
): Promise<WhatsAppSendResult> {
  const response = await fetch(
    `${META_API_URL}/${config.metaPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.metaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  const data = await response.json();
  if (response.ok) {
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      provider: "meta",
    };
  }
  return {
    success: false,
    error: data.error?.message || "Failed to send via Meta API",
    provider: "meta",
  };
}

async function sendTemplateViaMeta(
  config: WhatsAppConfig,
  payload: WhatsAppMessagePayload,
): Promise<WhatsAppSendResult> {
  const response = await fetch(
    `${META_API_URL}/${config.metaPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.metaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: payload.to,
        type: "template",
        template: {
          name: payload.templateName,
          language: { code: payload.languageCode || "en" },
          components:
            payload.parameters && payload.parameters.length > 0
              ? [
                  {
                    type: "body",
                    parameters: payload.parameters.map((p) => ({
                      type: "text",
                      text: p,
                    })),
                  },
                ]
              : undefined,
        },
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  const data = await response.json();
  if (response.ok) {
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      provider: "meta",
    };
  }
  return {
    success: false,
    error: data.error?.message || "Failed to send template via Meta API",
    provider: "meta",
  };
}

// ---- Twilio WhatsApp API ----

async function sendViaTwilio(
  config: WhatsAppConfig,
  to: string,
  body: string,
): Promise<WhatsAppSendResult> {
  const url = `${TWILIO_API_URL}/Accounts/${config.twilioAccountSid}/Messages.json`;
  const auth = btoa(`${config.twilioAccountSid}:${config.twilioAuthToken}`);

  const formData = new URLSearchParams();
  formData.append("From", `whatsapp:${config.twilioFromNumber}`);
  formData.append("To", `whatsapp:${to}`);
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
    return {
      success: true,
      messageId: data.sid,
      provider: "twilio",
    };
  }
  return {
    success: false,
    error: data.message || "Failed to send via Twilio",
    provider: "twilio",
  };
}

// ---- Interactive Messages (Quick Replies) ----

async function sendInteractiveViaMeta(
  config: WhatsAppConfig,
  payload: WhatsAppInteractivePayload,
): Promise<WhatsAppSendResult> {
  const response = await fetch(
    `${META_API_URL}/${config.metaPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.metaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: payload.to,
        type: "interactive",
        interactive: {
          type: "button",
          ...(payload.header
            ? { header: { type: "text", text: payload.header } }
            : {}),
          body: { text: payload.body },
          ...(payload.footer ? { footer: { text: payload.footer } } : {}),
          action: {
            buttons: payload.buttons.map((btn) => ({
              type: "reply",
              reply: { id: btn.id, title: btn.title },
            })),
          },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  const data = await response.json();
  if (response.ok) {
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      provider: "meta",
    };
  }
  return {
    success: false,
    error: data.error?.message || "Failed to send interactive message via Meta API",
    provider: "meta",
  };
}

// ---- Public API ----

/**
 * Send a WhatsApp interactive message with quick reply buttons.
 * Falls back to plain text with button labels appended for Twilio.
 */
export async function sendInteractiveMessage(
  payload: WhatsAppInteractivePayload,
): Promise<WhatsAppSendResult> {
  const config = getWhatsAppConfig();

  if (!isConfigured(config)) {
    return { success: false, error: "Not configured", provider: config.provider };
  }

  if (config.provider === "twilio") {
    // Twilio doesn't support interactive buttons — append button labels as text
    const buttonText = payload.buttons
      .map((btn) => `Reply ${btn.title} to ${btn.title.toLowerCase()}`)
      .join("\n");
    const body = `${payload.body}\n\n${buttonText}`;
    return sendViaTwilio(config, payload.to, body);
  }

  return sendInteractiveViaMeta(config, payload);
}

/**
 * Send a WhatsApp template message using the configured provider.
 */
export async function sendWhatsAppMessage(
  payload: WhatsAppMessagePayload,
): Promise<WhatsAppSendResult> {
  const config = getWhatsAppConfig();

  if (!isConfigured(config)) {
    // WhatsApp API credentials not configured
    return { success: false, error: "Not configured", provider: config.provider };
  }

  if (config.provider === "twilio") {
    // Twilio doesn't support template API the same way — send as text
    return sendViaTwilio(config, payload.to, payload.parameters?.join(", ") || "");
  }

  return sendTemplateViaMeta(config, payload);
}

/**
 * Send a plain text WhatsApp message using the configured provider.
 */
export async function sendTextMessage(
  to: string,
  body: string,
): Promise<WhatsAppSendResult> {
  const config = getWhatsAppConfig();

  if (!isConfigured(config)) {
    // WhatsApp API credentials not configured
    return { success: false, error: "Not configured", provider: config.provider };
  }

  if (config.provider === "twilio") {
    return sendViaTwilio(config, to, body);
  }

  return sendViaMeta(config, to, body);
}

/**
 * Return the correct template set for the given patient message locale.
 * Falls back to the default (French) templates when no locale-specific
 * set exists.
 */
export function getTemplatesForLocale(
  locale: PatientMessageLocale = "fr",
): NotificationTemplate[] {
  switch (locale) {
    case "darija":
      return toDarijaNotificationTemplates();
    case "ar":
      // Arabic templates can be added later; fall back to default for now
      return defaultNotificationTemplates;
    case "fr":
    default:
      return defaultNotificationTemplates;
  }
}

/**
 * Send a notification-triggered WhatsApp message with variable substitution.
 * Looks up the template for the given trigger, substitutes variables, and sends.
 *
 * When a `locale` is provided the function selects the matching template set
 * (e.g. Darija) automatically. The explicit `templates` parameter still takes
 * precedence if supplied so existing call-sites are unaffected.
 */
export async function sendNotificationWhatsApp(
  trigger: NotificationTrigger,
  to: string,
  variables: TemplateVariables,
  templates?: NotificationTemplate[],
  locale?: PatientMessageLocale,
): Promise<WhatsAppSendResult> {
  const resolvedTemplates =
    templates ?? getTemplatesForLocale(locale);

  const template = resolvedTemplates.find(
    (t) => t.trigger === trigger && t.enabled && t.channels.includes("whatsapp"),
  );

  if (!template) {
    return {
      success: false,
      error: `No enabled WhatsApp template found for trigger: ${trigger}`,
      provider: "meta",
    };
  }

  const body = substituteVariables(template.whatsappBody, variables);
  return sendTextMessage(to, body);
}
