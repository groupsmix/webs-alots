/**
 * WhatsApp Business API Integration
 *
 * Supports both Meta WhatsApp Business API (direct) and Twilio WhatsApp API.
 * Integrates with the notification engine for template-based messaging.
 */

import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";

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
  const response = await fetch(`${META_API_URL}/${config.metaPhoneNumberId}/messages`, {
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
  });

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
  const response = await fetch(`${META_API_URL}/${config.metaPhoneNumberId}/messages`, {
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
        ...(payload.header ? { header: { type: "text", text: payload.header } } : {}),
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
  });

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
 * Send a plain text WhatsApp message using the configured provider.
 */
export async function sendTextMessage(to: string, body: string): Promise<WhatsAppSendResult> {
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

// ---- DB-backed Template Loading ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

export interface WhatsAppTemplate {
  id: string;
  clinic_id: string;
  template_name: string;
  language: string;
  body_template: string;
  variables: Record<string, string>[];
  status: string;
  meta_template_id: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  booking_confirmation:
    "مرحبا {{patient_name}}، تم تأكيد موعدك مع {{doctor_name}} يوم {{date}} على الساعة {{time}}. {{clinic_name}}",
  appointment_reminder:
    "تذكير: عندك موعد غدا مع {{doctor_name}} على الساعة {{time}}. {{clinic_name}}",
  rescheduled: "تم تغيير موعدك مع {{doctor_name}} ل {{date}} على الساعة {{time}}. {{clinic_name}}",
  cancellation: "تم إلغاء موعدك مع {{doctor_name}} يوم {{date}}. {{clinic_name}}",
};

/**
 * Load a WhatsApp template for a specific clinic, falling back to
 * hardcoded defaults if no custom template exists in the database.
 */
export async function getWhatsAppTemplate(
  clinicId: string,
  templateName: string,
  language = "ar",
): Promise<string | null> {
  try {
    const supabase = await createTenantClient(clinicId);
    // Table added in migration 00101 — not yet in generated DB types
    const { data, error } = await (supabase as unknown as SupabaseUntyped)
      .from("whatsapp_templates")
      .select("body_template")
      .eq("clinic_id", clinicId)
      .eq("template_name", templateName)
      .eq("language", language)
      .eq("status", "approved")
      .single();

    if (!error && data) {
      return (data as { body_template: string }).body_template;
    }
  } catch (err) {
    logger.warn("Failed to load WhatsApp template from DB, using default", {
      context: "whatsapp/templates",
      clinicId,
      templateName,
      error: err,
    });
  }

  return DEFAULT_TEMPLATES[templateName] ?? null;
}

/**
 * Load all WhatsApp templates for a clinic.
 */
export async function getClinicWhatsAppTemplates(clinicId: string): Promise<WhatsAppTemplate[]> {
  try {
    const supabase = await createTenantClient(clinicId);
    // Table added in migration 00101 — not yet in generated DB types
    const { data, error } = await (supabase as unknown as SupabaseUntyped)
      .from("whatsapp_templates")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.warn("Failed to load clinic WhatsApp templates", {
        context: "whatsapp/templates",
        clinicId,
        error,
      });
      return [];
    }

    return (data ?? []) as WhatsAppTemplate[];
  } catch (err) {
    logger.warn("Error fetching clinic WhatsApp templates", {
      context: "whatsapp/templates",
      clinicId,
      error: err,
    });
    return [];
  }
}
