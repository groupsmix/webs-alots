import { z } from "zod";
import { phoneNumber } from "./primitives";

export const clinicProvisionSchema = z.object({
  clinic_name: z.string().min(1).max(200),
  clinic_type: z.enum([
    "doctor",
    "dentist",
    "pharmacy",
    "clinic",
    "hospital",
    "laboratory",
    "veterinary",
    "restaurant",
  ]),
  tier: z.enum(["vitrine", "cabinet", "pro", "premium"]),
  subdomain: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/),
  owner_name: z.string().min(1).max(200),
  owner_email: z.string().email().max(254),
  owner_phone: phoneNumber.optional(),
  city: z.string().max(200).optional(),
  specialty: z.string().max(200).optional(),
  whatsapp_number: z.string().max(30).optional(),
  payment_gateway: z.enum(["cmi", "stripe", "cash"]).optional(),
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
