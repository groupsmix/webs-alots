import { z } from "zod";
import { safeName, safeText } from "./primitives";

export const SUPPORTED_LANGUAGES = ["fr", "ar", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const FAQ_CATEGORIES = [
  "general",
  "booking",
  "services",
  "insurance",
  "hours",
  "location",
  "payment",
  "medical",
] as const;

// ── FAQ Schemas ──────────────────────────────────────────────────────

export const faqCreateSchema = z.object({
  question: safeText.pipe(z.string().min(3).max(500)),
  answer: safeText.pipe(z.string().min(3).max(2000)),
  keywords: z.array(z.string().max(100)).max(20).optional(),
  category: z.enum(FAQ_CATEGORIES).optional().default("general"),
  language: z.enum(SUPPORTED_LANGUAGES).optional().default("fr"),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional().default(true),
});

export const faqUpdateSchema = z.object({
  id: z.string().uuid(),
  question: safeText.pipe(z.string().min(3).max(500)).optional(),
  answer: safeText.pipe(z.string().min(3).max(2000)).optional(),
  keywords: z.array(z.string().max(100)).max(20).optional(),
  category: z.enum(FAQ_CATEGORIES).optional(),
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
});

export const faqDeleteSchema = z.object({
  id: z.string().uuid(),
});

export const faqSearchSchema = z.object({
  query: z.string().min(1).max(500),
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
  category: z.enum(FAQ_CATEGORIES).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

// ── Support Ticket Schemas ───────────────────────────────────────────

export const TICKET_CHANNELS = ["chat", "whatsapp", "email", "phone"] as const;
export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const ticketCreateSchema = z.object({
  subject: safeName.pipe(z.string().min(3).max(300)),
  channel: z.enum(TICKET_CHANNELS).optional().default("chat"),
  priority: z.enum(TICKET_PRIORITIES).optional().default("normal"),
  language: z.enum(SUPPORTED_LANGUAGES).optional().default("fr"),
  patient_phone: z.string().max(30).optional(),
  patient_name: safeName.pipe(z.string().max(200)).optional(),
  message: safeText.pipe(z.string().min(1).max(2000)).optional(),
});

export const ticketUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

export const ticketRatingSchema = z.object({
  id: z.string().uuid(),
  satisfaction_rating: z.number().int().min(1).max(5),
  satisfaction_comment: safeText.pipe(z.string().max(1000)).optional(),
});

export const ticketMessageSchema = z.object({
  ticket_id: z.string().uuid(),
  content: safeText.pipe(z.string().min(1).max(2000)),
  sender_type: z.enum(["patient", "staff", "bot"]).optional().default("staff"),
});

// ── WhatsApp Support Schemas ─────────────────────────────────────────

export const whatsappInboundSchema = z.object({
  phone_number: z.string().min(8).max(30),
  message: safeText.pipe(z.string().min(1).max(2000)),
  wa_message_id: z.string().max(200).optional(),
});

// ── Support Dashboard Schemas ─────────────────────────────────────────

export const supportDashboardQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  channel: z.enum(TICKET_CHANNELS).optional(),
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
});
