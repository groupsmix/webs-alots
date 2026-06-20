/**
 * GET  /api/admin/settings  — Load clinic profile, payment, booking, whatsapp, features
 * PUT  /api/admin/settings  — Save one section at a time
 *                             Body: { section: 'profile'|'payment'|'booking'|'whatsapp'|'features', data: {...} }
 *
 * Requires clinic_admin role.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["clinic_admin"];

// ── schemas ────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["doctor", "dentist", "pharmacy"]),
  phone: z.string().max(30).optional().default(""),
  whatsapp: z.string().max(30).optional().default(""),
  email: z.string().max(200).optional().default(""),
  address: z.string().max(500).optional().default(""),
  city: z.string().max(100).optional().default(""),
  googleMapsUrl: z.string().max(500).optional().default(""),
  website: z.string().max(200).optional().default(""),
});

const paymentSchema = z.object({
  currency: z.string().max(10).default("MAD"),
  methods: z.array(z.object({ name: z.string(), enabled: z.boolean() })).optional(),
  cmiMerchantId: z.string().max(200).optional().default(""),
  cmiSecretKey: z.string().max(500).optional().default(""),
});

const bookingSchema = z.object({
  slotDuration: z.number().int().min(5).max(240).default(30),
  bufferTime: z.number().int().min(0).max(60).default(5),
  maxAdvanceDays: z.number().int().min(1).max(365).default(30),
  maxPerSlot: z.number().int().min(1).max(20).default(1),
  cancellationHours: z.number().int().min(0).max(168).default(24),
  allowRescheduling: z.boolean().default(true),
  rescheduleHours: z.number().int().min(0).max(168).default(12),
  autoConfirm: z.boolean().default(false),
  noShowPolicy: z.string().max(1000).optional().default(""),
});

const whatsappSchema = z.object({
  patientMessageLocale: z.enum(["fr", "ar", "darija"]).default("fr"),
  templates: z.array(z.object({
    id: z.string(),
    name: z.string(),
    label: z.string(),
    enabled: z.boolean(),
    template: z.string(),
  })).optional(),
});

const featuresSchema = z.object({
  kioskModeEnabled: z.boolean().default(false),
  googlePlaceId: z.string().max(500).optional().default(""),
});

const putBodySchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("profile"), data: profileSchema }),
  z.object({ section: z.literal("payment"), data: paymentSchema }),
  z.object({ section: z.literal("booking"), data: bookingSchema }),
  z.object({ section: z.literal("whatsapp"), data: whatsappSchema }),
  z.object({ section: z.literal("features"), data: featuresSchema }),
]);

// ── GET ────────────────────────────────────────────────────────────────────

async function handleGet(_req: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiError("No clinic context", 400, "NO_CLINIC");

  try {
    const supabase = await createTenantClient(clinicId);

    const { data: clinic, error } = await supabase
      .from("clinics")
      .select(
        "name, type, phone, address, city, config, kiosk_mode_enabled, google_place_id, patient_message_locale, website_config",
      )
      .eq("id", clinicId)
      .single();

    if (error || !clinic) {
      logger.warn("Failed to fetch clinic settings", { context: "api/admin/settings", clinicId, error });
      return apiInternalError("Failed to load settings");
    }

    const cfg = (clinic.config ?? {}) as Record<string, unknown>;
    const wsCfg = (clinic.website_config ?? {}) as Record<string, unknown>;

    // Fetch WhatsApp templates for this clinic
    const { data: waTpls } = await supabase
      .from("whatsapp_templates")
      .select("id, template_name, body_template, status")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true });

    return apiSuccess({
      profile: {
        name: clinic.name ?? "",
        type: clinic.type ?? "doctor",
        phone: clinic.phone ?? (cfg.phone as string | null) ?? "",
        whatsapp: (cfg.whatsappNumber as string | null) ?? "",
        email: (cfg.email as string | null) ?? "",
        address: clinic.address ?? "",
        city: (wsCfg.city as string | null) ?? "",
        googleMapsUrl: (wsCfg.googleMapsUrl as string | null) ?? "",
        website: (wsCfg.website as string | null) ?? "",
      },
      payment: {
        currency: (cfg.currency as string | null) ?? "MAD",
        methods: (cfg.paymentMethods as { name: string; enabled: boolean }[] | null) ?? [
          { name: "Cash", enabled: true },
          { name: "Card", enabled: true },
          { name: "Insurance", enabled: true },
          { name: "Online Transfer", enabled: false },
        ],
        cmiMerchantId: (cfg.cmiMerchantId as string | null) ?? "",
        cmiSecretKey: "", // never return secret on GET
      },
      booking: {
        slotDuration: (cfg.slotDuration as number | null) ?? 30,
        bufferTime: (cfg.bufferTime as number | null) ?? 5,
        maxAdvanceDays: (cfg.maxAdvanceDays as number | null) ?? 30,
        maxPerSlot: (cfg.maxPerSlot as number | null) ?? 1,
        cancellationHours: (cfg.cancellationHours as number | null) ?? 24,
        allowRescheduling: (cfg.allowRescheduling as boolean | null) ?? true,
        rescheduleHours: (cfg.rescheduleHours as number | null) ?? 12,
        autoConfirm: (cfg.autoConfirm as boolean | null) ?? false,
        noShowPolicy: (cfg.noShowPolicy as string | null) ?? "",
      },
      whatsapp: {
        patientMessageLocale: clinic.patient_message_locale ?? "fr",
        templates: (waTpls ?? []).map((t) => ({
          id: t.id,
          name: t.template_name,
          label: t.template_name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          enabled: t.status === "active",
          template: t.body_template,
        })),
      },
      features: {
        kioskModeEnabled: clinic.kiosk_mode_enabled ?? false,
        googlePlaceId: clinic.google_place_id ?? "",
      },
    });
  } catch (err) {
    logger.error("Unexpected error in GET /api/admin/settings", { error: err });
    return apiInternalError("Unexpected error");
  }
}

// ── PUT ────────────────────────────────────────────────────────────────────

async function handlePut(req: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiError("No clinic context", 400, "NO_CLINIC");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400, "INVALID_JSON");
  }

  const parsed = putBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400, "VALIDATION_ERROR");
  }

  const { section, data } = parsed.data;

  try {
    const supabase = await createTenantClient(clinicId);

    // Fetch current config to merge into
    const { data: current } = await supabase
      .from("clinics")
      .select("config, website_config")
      .eq("id", clinicId)
      .single();

    const currentConfig = ((current?.config ?? {}) as Record<string, unknown>);
    const currentWsCfg = ((current?.website_config ?? {}) as Record<string, unknown>);

    if (section === "profile") {
      const d = data as z.infer<typeof profileSchema>;
      await supabase
        .from("clinics")
        .update({
          name: d.name,
          type: d.type,
          phone: d.phone || null,
          address: d.address || null,
          config: { ...currentConfig, whatsappNumber: d.whatsapp || null, email: d.email || null },
          website_config: {
            ...currentWsCfg,
            city: d.city || null,
            googleMapsUrl: d.googleMapsUrl || null,
            website: d.website || null,
          },
        })
        .eq("id", clinicId);
    } else if (section === "payment") {
      const d = data as z.infer<typeof paymentSchema>;
      const newCfg: Record<string, unknown> = {
        ...currentConfig,
        currency: d.currency,
        paymentMethods: d.methods,
      };
      if (d.cmiMerchantId) newCfg.cmiMerchantId = d.cmiMerchantId;
      if (d.cmiSecretKey) newCfg.cmiSecretKey = d.cmiSecretKey;
      await supabase.from("clinics").update({ config: newCfg }).eq("id", clinicId);
    } else if (section === "booking") {
      const d = data as z.infer<typeof bookingSchema>;
      await supabase
        .from("clinics")
        .update({
          config: {
            ...currentConfig,
            slotDuration: d.slotDuration,
            bufferTime: d.bufferTime,
            maxAdvanceDays: d.maxAdvanceDays,
            maxPerSlot: d.maxPerSlot,
            cancellationHours: d.cancellationHours,
            allowRescheduling: d.allowRescheduling,
            rescheduleHours: d.rescheduleHours,
            autoConfirm: d.autoConfirm,
            noShowPolicy: d.noShowPolicy,
          },
        })
        .eq("id", clinicId);
    } else if (section === "whatsapp") {
      const d = data as z.infer<typeof whatsappSchema>;
      // Update locale
      await supabase
        .from("clinics")
        .update({ patient_message_locale: d.patientMessageLocale })
        .eq("id", clinicId);
      // Upsert WA templates
      if (d.templates && d.templates.length > 0) {
        for (const tpl of d.templates) {
          await supabase.from("whatsapp_templates").upsert(
            {
              id: tpl.id.startsWith("t") ? undefined : tpl.id, // allow generated UUIDs only
              clinic_id: clinicId,
              template_name: tpl.name,
              language: "ar",
              body_template: tpl.template,
              status: tpl.enabled ? "active" : "paused",
              variables: [],
            },
            { onConflict: "id", ignoreDuplicates: false },
          );
        }
      }
    } else if (section === "features") {
      const d = data as z.infer<typeof featuresSchema>;
      await supabase
        .from("clinics")
        .update({
          kiosk_mode_enabled: d.kioskModeEnabled,
          google_place_id: d.googlePlaceId || null,
        })
        .eq("id", clinicId);
    }

    return apiSuccess({ ok: true, section });
  } catch (err) {
    logger.error("Unexpected error in PUT /api/admin/settings", { context: section, error: err });
    return apiInternalError("Failed to save settings");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const PUT = withAuth(handlePut, ALLOWED_ROLES);
