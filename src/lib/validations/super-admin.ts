import { z } from "zod";
import { phoneNumber } from "./primitives";

const booleanish = z.preprocess((value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

export const clinicProvisionSchema = z.object({
  clinic_name: z.string().min(1).max(200),
  // The clinics.type column (and ClinicType) only supports these three
  // "system types" — the feature/permission system is keyed off them. Verticals
  // such as veterinary/laboratory are modelled separately via clinic_types, not
  // clinics.type, so accepting them here only produced CHECK-constraint crashes
  // (Audit #2). Keep this enum aligned with ClinicType in types/database.ts.
  clinic_type: z.enum(["doctor", "dentist", "pharmacy"]),
  tier: z.enum(["vitrine", "cabinet", "pro", "premium", "saas"]),
  subdomain: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/),
  owner_name: z.string().min(1).max(200),
  owner_email: z.string().email().max(254),
  owner_phone: phoneNumber.optional(),
  city: z.string().max(200).optional(),
  specialty: z.string().max(200).optional(),
  whatsapp_number: z.string().max(30).optional(),
  payment_gateway: z.enum(["cmi", "stripe", "cash"]).optional(),
  // Optional design/branding carried over from the agent builder so the
  // deployed site reflects the previewed design immediately. Kept optional and
  // backward-compatible with the existing super-admin onboarding wizard.
  //
  // Canonical branding columns (consumed by getPublicBranding):
  primary_color: z.string().max(20).optional(),
  secondary_color: z.string().max(20).optional(),
  template_id: z.enum(["modern", "classic", "minimal"]).optional(),
  // Richer builder snapshot persisted into clinics.config: the full palette,
  // the chosen template, and the generated service list.
  template: z.enum(["modern", "classic", "minimal"]).optional(),
  theme_colors: z
    .array(z.string().regex(/^#[0-9a-fA-F]{3,8}$/))
    .max(8)
    .optional(),
  services: z.array(z.string().min(1).max(120)).max(50).optional(),
});

export const churnPredictionQuerySchema = z.object({
  risk_level: z.enum(["low", "medium", "high", "critical", "all"]).optional().default("all"),
  sort_by: z.enum(["score", "clinic_name", "calculated_at"]).optional().default("score"),
  sort_order: z.enum(["asc", "desc"]).optional().default("desc"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const revenueForecastQuerySchema = z.object({
  months_ahead: z.coerce.number().int().min(1).max(12).optional().default(3),
});

export const clinicHealthQuerySchema = z.object({
  clinic_id: z.string().uuid().optional(),
  churn_risk: z.enum(["low", "medium", "high", "critical", "all"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(500).optional().default(25),
  include_alerts: booleanish.optional().default(true),
});

export const clinicHealthMutationSchema = z.object({
  clinic_id: z.string().uuid().optional(),
  create_alerts: booleanish.optional().default(true),
});

export const clinicNarrativeRequestSchema = z.object({
  clinic_id: z.string().uuid().optional(),
  refresh: booleanish.optional().default(false),
});

export const clinicAnalyticsQuerySchema = z.object({
  question: z.string().min(3).max(500),
  clinic_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
