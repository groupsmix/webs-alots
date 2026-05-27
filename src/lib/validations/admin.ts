import { z } from "zod";

export const onboardingSchema = z.object({
  clinic_type_key: z.string().min(1).max(100),
  category: z.string().max(100).optional(),
  clinic_name: z.string().min(1).max(200),
  owner_name: z.string().min(1).max(200),
  phone: z.string().min(1).max(30),
  email: z.string().email().max(254).optional(),
  city: z.string().max(200).optional(),
});

export const impersonateSchema = z.object({
  clinicId: z.string().min(1),
  clinicName: z.string().max(200).optional(),
  password: z.string().min(1, "Password is required for impersonation"),
  reason: z.string().min(3, "A reason is required for impersonation").max(500),
});

export const customFieldCreateSchema = z.object({
  clinic_type_key: z.string().min(1).max(100),
  entity_type: z.string().min(1).max(100),
  field_key: z.string().min(1).max(100),
  field_type: z.string().min(1).max(50),
  label_fr: z.string().min(1).max(200),
  label_ar: z.string().max(200).optional().default(""),
  description: z.string().max(500).nullable().optional().default(null),
  placeholder: z.string().max(200).nullable().optional().default(null),
  is_required: z.boolean().optional().default(false),
  sort_order: z.number().int().optional().default(0),
  options: z.array(z.unknown()).optional().default([]),
  validation: z.record(z.string(), z.unknown()).optional().default({}),
  default_value: z.unknown().nullable().optional().default(null),
});

export const customFieldUpdateSchema = z.object({
  id: z.string().min(1),
  label_fr: z.string().min(1).max(200).optional(),
  label_ar: z.string().max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  placeholder: z.string().max(200).nullable().optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  options: z.array(z.unknown()).optional(),
  validation: z.record(z.string(), z.unknown()).optional(),
  default_value: z.unknown().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const customFieldValuesSchema = z.object({
  /** @deprecated Ignored by the server — clinic_id is derived from the authenticated user's profile. Remove after v2 API migration (all clients updated). */
  clinic_id: z.string().optional(),
  entity_type: z.string().min(1).max(100),
  entity_id: z.string().min(1),
  field_values: z.record(z.string(), z.unknown()),
});

export const brandingUpdateSchema = z.object({
  primary_color: z.string().max(20).optional(),
  secondary_color: z.string().max(20).optional(),
  heading_font: z.string().max(100).optional(),
  body_font: z.string().max(100).optional(),
  name: z.string().max(200).optional(),
  tagline: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  template_id: z.string().max(50).optional(),
  section_visibility: z.record(z.string(), z.boolean()).optional(),
});

export const applyPresetSchema = z.object({
  presetId: z.string().min(1).max(100),
});

export const consentSchema = z.object({
  consentType: z.enum([
    "cookies_accepted",
    "cookies_declined",
    "data_processing",
    "marketing_emails",
    "terms_accepted",
    "privacy_policy_accepted",
  ]),
  granted: z.boolean(),
});

export const clinicFeaturesQuerySchema = z.object({
  type_key: z.string().min(1).max(100),
});

export const verifyEmailSendSchema = z.object({
  email: z.string().email().max(254),
});

export const verifyEmailConfirmSchema = z.object({
  email: z.string().email().max(254),
  code: z.string().length(6),
});
