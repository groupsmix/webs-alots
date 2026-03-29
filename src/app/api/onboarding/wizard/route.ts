import { logger } from "@/lib/logger";
import { z } from "zod";
import { withAuthValidation } from "@/lib/api-validate";
import { sendTextMessage } from "@/lib/whatsapp";
import { invalidateAllSubdomainCaches } from "@/lib/subdomain-cache";
import { apiForbidden, apiSuccess } from "@/lib/api-response";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const serviceSchema = z.object({
  name: z.string().min(1).max(200),
  duration_minutes: z.number().int().min(1).max(480),
  price: z.number().min(0).finite(),
});

const scheduleEntrySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM"),
  break_start: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  break_end: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

const brandingSchema = z.object({
  primary_color: z.string().max(20).optional(),
  secondary_color: z.string().max(20).optional(),
  template_id: z.string().max(50).optional(),
});

const wizardSchema = z.object({
  clinic_id: z.string().min(1),
  services: z.array(serviceSchema).optional().default([]),
  schedule: z.array(scheduleEntrySchema).optional().default([]),
  branding: brandingSchema.optional(),
  go_live: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// POST /api/onboarding/wizard
//
// Saves extended onboarding data: services, schedule (time_slots), and
// branding after the initial clinic creation.  Optionally sends a WhatsApp
// welcome message when go_live is true.
// ---------------------------------------------------------------------------

export const POST = withAuthValidation(wizardSchema, async (body, request, { supabase, profile }) => {

    // Verify the authenticated user owns the clinic
    if (profile.clinic_id !== body.clinic_id) {
      return apiForbidden("You are not authorised for this clinic");
    }

    // ------------------------------------------------------------------
    // 1. Upsert services
    // ------------------------------------------------------------------
    if (body.services.length > 0) {
      const serviceRows = body.services.map((s) => ({
        clinic_id: body.clinic_id,
        name: s.name,
        duration_minutes: s.duration_minutes,
        price: s.price,
        is_active: true,
      }));

      const { error: svcError } = await supabase
        .from("services")
        .insert(serviceRows);

      if (svcError) {
        logger.warn("Failed to insert services", {
          context: "onboarding/wizard",
          error: svcError,
        });
        // Non-fatal — continue with the rest
      }
    }

    // ------------------------------------------------------------------
    // 2. Upsert schedule (time_slots)
    // ------------------------------------------------------------------
    if (body.schedule.length > 0) {
      // time_slots requires doctor_id — use the profile.id of the
      // authenticated clinic admin who is also the initial doctor.
      const slotRows = body.schedule.map((slot) => ({
        clinic_id: body.clinic_id,
        doctor_id: profile.id,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_active: true,
      }));

      const { error: slotError } = await supabase
        .from("time_slots")
        .insert(slotRows);

      if (slotError) {
        logger.warn("Failed to insert time_slots", {
          context: "onboarding/wizard",
          error: slotError,
        });
      }
    }

    // ------------------------------------------------------------------
    // 3. Update branding
    // ------------------------------------------------------------------
    if (body.branding) {
      const brandingUpdate: {
        primary_color?: string;
        secondary_color?: string;
        template_id?: string;
      } = {};
      if (body.branding.primary_color)
        brandingUpdate.primary_color = body.branding.primary_color;
      if (body.branding.secondary_color)
        brandingUpdate.secondary_color = body.branding.secondary_color;
      if (body.branding.template_id)
        brandingUpdate.template_id = body.branding.template_id;

      if (Object.keys(brandingUpdate).length > 0) {
        const { error: brandError } = await supabase
          .from("clinics")
          .update(brandingUpdate)
          .eq("id", body.clinic_id);

        if (brandError) {
          logger.warn("Failed to update branding", {
            context: "onboarding/wizard",
            error: brandError,
          });
        } else {
          // Invalidate subdomain cache so middleware picks up branding changes
          invalidateAllSubdomainCaches();
        }
      }
    }

    // ------------------------------------------------------------------
    // 4. Go live — send WhatsApp welcome message
    // ------------------------------------------------------------------
    if (body.go_live) {
      // Fetch the clinic to get its subdomain and owner phone
      const { data: clinic } = await supabase
        .from("clinics")
        .select("name, subdomain, phone, owner_name")
        .eq("id", body.clinic_id)
        .single();

      if (clinic?.phone) {
        const siteUrl = clinic.subdomain
          ? `https://${clinic.subdomain}.oltigo.com`
          : "https://oltigo.com";
        const name = clinic.owner_name || clinic.name || "Docteur";
        const message =
          `Bienvenue sur Oltigo, ${name} ! 🎉\n\n` +
          `Votre site est maintenant en ligne :\n${siteUrl}\n\n` +
          `Vos patients peuvent prendre rendez-vous dès maintenant. ` +
          `Bonne continuation !`;

        try {
          await sendTextMessage(clinic.phone, message);
        } catch (whatsappErr) {
          logger.warn("WhatsApp welcome message failed", {
            context: "onboarding/wizard",
            error: whatsappErr,
          });
          // Non-fatal — clinic is still live
        }
      }
    }

    return apiSuccess({
      status: "ok",
      message: body.go_live
        ? "Clinic is live — congratulations!"
        : "Wizard data saved",
    });
}, null);
