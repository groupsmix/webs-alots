/**
 * Schémas de validation Zod pour les opérations WhatsApp.
 */

import { z } from "zod";

// ── Consentement WhatsApp ──

export const whatsappConsentGrantSchema = z.object({
  patientId: z.string().uuid(),
  patientPhone: z.string().min(8).max(30),
  method: z.enum(["whatsapp_reply", "web_form", "in_person", "api"]),
  dataCategories: z.array(z.string().max(100)).max(20).optional(),
});

export const whatsappConsentRevokeSchema = z.object({
  patientId: z.string().uuid(),
});

export const whatsappConsentExportSchema = z.object({
  patientId: z.string().uuid(),
});

export const whatsappConsentDeleteSchema = z.object({
  patientId: z.string().uuid(),
});

// ── Voice Booking ──

export const whatsappVoiceWebhookSchema = z.object({
  mediaId: z.string().min(1).max(500),
  mimeType: z.string().max(100).optional().default("audio/ogg"),
  senderPhone: z.string().min(8).max(30),
});

// ── WABA Routing ──

export const wabaPhoneNumberIdSchema = z.string().min(1).max(200);
