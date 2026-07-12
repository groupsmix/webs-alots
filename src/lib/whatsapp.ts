/**
 * WhatsApp Business API Integration
 *
 * Supports both Meta WhatsApp Business API (direct) and Twilio WhatsApp API.
 * Integrates with the notification engine for template-based messaging.
 */

import { safeFetch } from "@/lib/fetch-wrapper";
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
  /** clinic_id for observability (structured logging) */
  clinicId?: string;
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
  options?: { clinicId?: string; messageType?: string },
): Promise<WhatsAppSendResult> {
  const response = await safeFetch(`${META_API_URL}/${config.metaPhoneNumberId}/messages`, {
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
    const messageId = data.messages?.[0]?.id;
    logger.info("WhatsApp message sent via Meta", {
      context: "whatsapp",
      provider: "meta",
      messageType: options?.messageType ?? "text",
      phone: to,
      messageId,
      clinicId: options?.clinicId,
    });
    return {
      success: true,
      messageId,
      provider: "meta",
    };
  }

  logger.error("WhatsApp message failed via Meta", {
    context: "whatsapp",
    alert: "whatsapp_failure",
    provider: "meta",
    messageType: options?.messageType ?? "text",
    phone: to,
    clinicId: options?.clinicId,
    error: data.error || "Unknown Meta API error",
  });

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
  options?: { clinicId?: string; messageType?: string },
): Promise<WhatsAppSendResult> {
  const url = `${TWILIO_API_URL}/Accounts/${config.twilioAccountSid}/Messages.json`;
  const auth = btoa(`${config.twilioAccountSid}:${config.twilioAuthToken}`);

  const formData = new URLSearchParams();
  formData.append("From", `whatsapp:${config.twilioFromNumber}`);
  formData.append("To", `whatsapp:${to}`);
  formData.append("Body", body);

  const response = await safeFetch(url, {
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
    const messageId = data.sid;
    logger.info("WhatsApp message sent via Twilio", {
      context: "whatsapp",
      provider: "twilio",
      messageType: options?.messageType ?? "text",
      phone: to,
      messageId,
      clinicId: options?.clinicId,
    });
    return {
      success: true,
      messageId,
      provider: "twilio",
    };
  }

  logger.error("WhatsApp message failed via Twilio", {
    context: "whatsapp",
    alert: "whatsapp_failure",
    provider: "twilio",
    messageType: options?.messageType ?? "text",
    phone: to,
    clinicId: options?.clinicId,
    error: data || "Unknown Twilio API error",
  });

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
  const response = await safeFetch(`${META_API_URL}/${config.metaPhoneNumberId}/messages`, {
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
    const messageId = data.messages?.[0]?.id;
    logger.info("WhatsApp interactive message sent via Meta", {
      context: "whatsapp",
      provider: "meta",
      messageType: "interactive",
      phone: payload.to,
      messageId,
      clinicId: payload.clinicId,
    });
    return {
      success: true,
      messageId,
      provider: "meta",
    };
  }

  logger.error("WhatsApp interactive message failed via Meta", {
    context: "whatsapp",
    alert: "whatsapp_failure",
    provider: "meta",
    messageType: "interactive",
    phone: payload.to,
    clinicId: payload.clinicId,
    error: data.error || "Unknown Meta API error",
  });

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
    logger.error("WhatsApp interactive message failed — not configured", {
      context: "whatsapp",
      alert: "whatsapp_failure",
      provider: config.provider,
      messageType: "interactive",
      phone: payload.to,
      clinicId: payload.clinicId,
    });
    return { success: false, error: "Not configured", provider: config.provider };
  }

  if (config.provider === "twilio") {
    // Twilio doesn't support interactive buttons — append button labels as text
    const buttonText = payload.buttons
      .map((btn) => `Reply ${btn.title} to ${btn.title.toLowerCase()}`)
      .join("\n");
    const body = `${payload.body}\n\n${buttonText}`;
    return sendViaTwilio(config, payload.to, body, {
      clinicId: payload.clinicId,
      messageType: "interactive",
    });
  }

  return sendInteractiveViaMeta(config, payload);
}

/**
 * Send a plain text WhatsApp message using the configured provider.
 */
export async function sendTextMessage(
  to: string,
  body: string,
  clinicId?: string,
): Promise<WhatsAppSendResult> {
  const config = getWhatsAppConfig();

  if (!isConfigured(config)) {
    logger.error("WhatsApp text message failed — not configured", {
      context: "whatsapp",
      alert: "whatsapp_failure",
      provider: config.provider,
      messageType: "text",
      phone: to,
      clinicId,
    });
    return { success: false, error: "Not configured", provider: config.provider };
  }

  if (config.provider === "twilio") {
    return sendViaTwilio(config, to, body, { clinicId, messageType: "text" });
  }

  return sendViaMeta(config, to, body, { clinicId, messageType: "text" });
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

const DEFAULT_TEMPLATES: Record<string, Record<string, string>> = {
  booking_confirmation: {
    ar: "مرحبا {{patient_name}}، تم تأكيد موعدك مع {{doctor_name}} يوم {{date}} على الساعة {{time}}. {{clinic_name}}",
    fr: "Bonjour {{patient_name}}, votre rendez-vous avec {{doctor_name}} est confirmé le {{date}} à {{time}}. {{clinic_name}}",
    darija:
      "سلام {{patient_name}}، رانديفو ديالك مع {{doctor_name}} تأكد نهار {{date}} ف{{time}}. {{clinic_name}}",
  },
  appointment_reminder: {
    ar: "تذكير: عندك موعد غدا مع {{doctor_name}} على الساعة {{time}}. {{clinic_name}}",
    fr: "Rappel: vous avez rendez-vous demain avec {{doctor_name}} à {{time}}. {{clinic_name}}",
    darija: "تذكار: عندك رانديفو غدا مع {{doctor_name}} ف{{time}}. {{clinic_name}}",
  },
  reminder_24h: {
    ar: "مرحبا {{patient_name}}، تذكير: عندك موعد غدا مع {{doctor_name}} على الساعة {{time}}. {{clinic_name}}",
    fr: "Bonjour {{patient_name}}, rappel: vous avez rendez-vous demain avec {{doctor_name}} à {{time}}. {{clinic_name}}",
    darija:
      "سلام {{patient_name}}، تذكار: عندك رانديفو غدا مع {{doctor_name}} ف{{time}}. {{clinic_name}}",
  },
  reminder_1h: {
    ar: "مرحبا {{patient_name}}، تذكير: موعدك بعد ساعة مع {{doctor_name}} على الساعة {{time}}. {{clinic_name}}",
    fr: "Bonjour {{patient_name}}, rappel: votre rendez-vous avec {{doctor_name}} est dans 1 heure à {{time}}. {{clinic_name}}",
    darija:
      "سلام {{patient_name}}، تذكار: رانديفو ديالك بعد ساعة مع {{doctor_name}} ف{{time}}. {{clinic_name}}",
  },
  reminder_2h: {
    ar: "مرحبا {{patient_name}}، تذكير: موعدك بعد ساعتين مع {{doctor_name}} على الساعة {{time}}. {{clinic_name}}",
    fr: "Bonjour {{patient_name}}, rappel: votre rendez-vous avec {{doctor_name}} est dans 2 heures à {{time}}. {{clinic_name}}",
    darija:
      "سلام {{patient_name}}، تذكار: رانديفو ديالك بعد ساعتين مع {{doctor_name}} ف{{time}}. {{clinic_name}}",
  },
  rescheduled: {
    ar: "تم تغيير موعدك مع {{doctor_name}} ل {{date}} على الساعة {{time}}. {{clinic_name}}",
    fr: "Votre rendez-vous avec {{doctor_name}} a été reprogrammé au {{date}} à {{time}}. {{clinic_name}}",
    darija: "بدلنا رانديفو ديالك مع {{doctor_name}} نهار {{date}} ف{{time}}. {{clinic_name}}",
  },
  cancellation: {
    ar: "تم إلغاء موعدك مع {{doctor_name}} يوم {{date}}. {{clinic_name}}",
    fr: "Votre rendez-vous avec {{doctor_name}} du {{date}} a été annulé. {{clinic_name}}",
    darija: "لغينا رانديفو ديالك مع {{doctor_name}} نهار {{date}}. {{clinic_name}}",
  },
  no_show: {
    ar: "مرحبا {{patient_name}}، لاحظنا أنك لم تحضر إلى موعدك مع {{doctor_name}} يوم {{date}}. هل تريد إعادة تحديد موعد؟ {{clinic_phone}} — {{clinic_name}}",
    fr: "Bonjour {{patient_name}}, nous avons remarqué que vous n'êtes pas venu(e) à votre rendez-vous avec {{doctor_name}} le {{date}}. Souhaitez-vous en reprogrammer un ? {{clinic_phone}} — {{clinic_name}}",
    darija:
      "سلام {{patient_name}}، لاحظنا بلي ما جيتيش للرانديفو ديالك مع {{doctor_name}} نهار {{date}}. بغيتي ترجع تحدد موعد؟ {{clinic_phone}} — {{clinic_name}}",
  },
  nps_survey: {
    ar: "مرحبا {{patient_name}}، كيف كانت تجربتك مع الدكتور {{doctor_name}}؟ شاركنا رأيك: {{survey_url}} — {{clinic_name}}",
    fr: "Bonjour {{patient_name}}, comment s'est passée votre consultation avec {{doctor_name}} ? Partagez votre avis : {{survey_url}} — {{clinic_name}}",
    darija:
      "سلام {{patient_name}}، كيفاش كانت تجربتك مع {{doctor_name}}؟ قولينا رأيك: {{survey_url}} — {{clinic_name}}",
  },
};

// ---- Per-Clinic Template Message Sender ----

/**
 * Per-clinic WhatsApp template message parameters.
 * Uses the clinic's own phone number ID and access token instead of
 * the global env-var credentials, enabling true per-tenant messaging.
 */
export interface WhatsAppTemplateParams {
  /** E.164 recipient phone number, e.g. +212661234567 */
  to: string;
  /** Approved Meta template name, e.g. 'appointment_reminder_24h' */
  templateName: string;
  /** BCP-47 language code, e.g. 'fr', 'ar' */
  languageCode: string;
  /** Positional text substitutions for the template body component */
  bodyParameters: string[];
  /** clinics.whatsapp_phone_id for this clinic */
  phoneNumberId: string;
  /** clinic_whatsapp_credentials.whatsapp_access_token for this clinic
   *  (server-only — fetched via createAdminClient). */
  accessToken: string;
  /** clinic_id for observability (structured logging) */
  clinicId?: string;
}

/**
 * Send a WhatsApp template message using per-clinic credentials.
 * Bypasses the global env-var config so each tenant uses its own
 * approved phone number and access token.
 *
 * Returns success=false (non-throwing) if phoneNumberId or accessToken
 * are absent so callers can handle misconfigured clinics gracefully.
 */
export async function sendWhatsAppTemplateMessage(
  params: WhatsAppTemplateParams,
): Promise<WhatsAppSendResult> {
  if (!params.phoneNumberId || !params.accessToken) {
    logger.error("WhatsApp template message failed — missing credentials", {
      context: "whatsapp",
      alert: "whatsapp_failure",
      provider: "meta",
      messageType: "template",
      phone: params.to,
      clinicId: params.clinicId,
      templateName: params.templateName,
    });
    return {
      success: false,
      error: "WhatsApp not configured for this clinic (missing phone_id or token)",
      provider: "meta",
    };
  }

  const bodyComponents =
    params.bodyParameters.length > 0
      ? [
          {
            type: "body",
            parameters: params.bodyParameters.map((text) => ({ type: "text", text })),
          },
        ]
      : [];

  const response = await safeFetch(`${META_API_URL}/${params.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.to,
      type: "template",
      template: {
        name: params.templateName,
        language: { code: params.languageCode },
        components: bodyComponents,
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const data = await response.json();
  if (response.ok) {
    const messageId = data.messages?.[0]?.id;
    logger.info("WhatsApp template message sent via Meta", {
      context: "whatsapp",
      provider: "meta",
      messageType: "template",
      phone: params.to,
      messageId,
      clinicId: params.clinicId,
      templateName: params.templateName,
    });
    return {
      success: true,
      messageId,
      provider: "meta",
    };
  }

  logger.error("WhatsApp template message failed via Meta", {
    context: "whatsapp",
    alert: "whatsapp_failure",
    provider: "meta",
    messageType: "template",
    phone: params.to,
    clinicId: params.clinicId,
    templateName: params.templateName,
    error: data.error || "Unknown Meta API error",
  });

  return {
    success: false,
    error: data.error?.message || "Failed to send template message via Meta API",
    provider: "meta",
  };
}

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
      .from("whatsapp_templates") // nosemgrep: semgrep.tenant-scoping
      .select("body_template") // nosemgrep: semgrep.tenant-scoping
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

  return DEFAULT_TEMPLATES[templateName]?.[language] ?? null;
}

/**
 * Load all WhatsApp templates for a clinic.
 */
