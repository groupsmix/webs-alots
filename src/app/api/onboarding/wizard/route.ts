import { z } from "zod";
import { apiForbidden, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { getDefaultServices } from "@/lib/config/default-services";
import { sendEmail } from "@/lib/email";
import { onboardingWelcomeEmail } from "@/lib/email-templates";
import { logger } from "@/lib/logger";
import { invalidateAllSubdomainCaches } from "@/lib/subdomain-cache";
import { TEMPLATE_PRESETS } from "@/lib/template-presets";
import { sendTextMessage } from "@/lib/whatsapp";

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
  preset_id: z.string().max(100).nullable().optional(),
  auto_seed: z.boolean().optional().default(false),
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
    // 0. Resolve preset for auto-seeding
    // ------------------------------------------------------------------
    const preset = body.preset_id ? TEMPLATE_PRESETS[body.preset_id] : null;

    // ------------------------------------------------------------------
    // 1. Upsert services (explicit or auto-seeded from preset)
    // ------------------------------------------------------------------
    let servicesToInsert = body.services;

    if (servicesToInsert.length === 0 && body.auto_seed && preset) {
      // Auto-seed services from the preset's defaultServices key
      const defaults = getDefaultServices(preset.defaultServices);
      servicesToInsert = defaults.map((s) => ({
        name: s.name,
        duration_minutes: s.duration_minutes,
        price: s.price,
      }));
    }

    if (servicesToInsert.length > 0) {
      const serviceRows = servicesToInsert.map((s) => ({
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
    // 2. Upsert schedule (time_slots) — explicit or auto-seeded
    // ------------------------------------------------------------------
    let scheduleToInsert = body.schedule;

    if (scheduleToInsert.length === 0 && body.auto_seed) {
      // Auto-seed Mon-Sat 9am-6pm schedule
      scheduleToInsert = [
        { day_of_week: 1, start_time: "09:00", end_time: "18:00", break_start: null, break_end: null },
        { day_of_week: 2, start_time: "09:00", end_time: "18:00", break_start: null, break_end: null },
        { day_of_week: 3, start_time: "09:00", end_time: "18:00", break_start: null, break_end: null },
        { day_of_week: 4, start_time: "09:00", end_time: "18:00", break_start: null, break_end: null },
        { day_of_week: 5, start_time: "09:00", end_time: "18:00", break_start: null, break_end: null },
        { day_of_week: 6, start_time: "09:00", end_time: "13:00", break_start: null, break_end: null },
      ];
    }

    if (scheduleToInsert.length > 0) {
      // time_slots requires doctor_id — use the profile.id of the
      // authenticated clinic admin who is also the initial doctor.
      const slotRows = scheduleToInsert.map((slot) => ({
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
    // 3. Update branding (explicit or auto-seeded from preset)
    // ------------------------------------------------------------------
    if (body.branding || (body.auto_seed && preset)) {
      const brandingUpdate: {
        primary_color?: string;
        secondary_color?: string;
        template_id?: string;
        hero_title?: string;
        hero_title_ar?: string;
        hero_subtitle?: string;
        hero_subtitle_ar?: string;
      } = {};

      if (body.branding?.primary_color)
        brandingUpdate.primary_color = body.branding.primary_color;
      if (body.branding?.secondary_color)
        brandingUpdate.secondary_color = body.branding.secondary_color;
      if (body.branding?.template_id)
        brandingUpdate.template_id = body.branding.template_id;

      // Auto-seed branding from preset if not explicitly provided
      if (body.auto_seed && preset) {
        if (!brandingUpdate.primary_color)
          brandingUpdate.primary_color = preset.theme.primaryColor;
        if (!brandingUpdate.secondary_color)
          brandingUpdate.secondary_color = preset.theme.secondaryColor;
        if (!brandingUpdate.template_id)
          brandingUpdate.template_id = preset.templateId;
        // Set hero content from preset
        brandingUpdate.hero_title = preset.hero.title;
        brandingUpdate.hero_title_ar = preset.hero.titleAr;
        brandingUpdate.hero_subtitle = preset.hero.subtitle;
        brandingUpdate.hero_subtitle_ar = preset.hero.subtitleAr;
      }

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
    // 3b. Auto-seed section visibility from preset
    // ------------------------------------------------------------------
    if (body.auto_seed && preset && Object.keys(preset.sections).length > 0) {
      const { error: secError } = await supabase
        .from("clinics")
        .update({ section_visibility: preset.sections })
        .eq("id", body.clinic_id);

      if (secError) {
        logger.warn("Failed to update section visibility", {
          context: "onboarding/wizard",
          error: secError,
        });
      }
    }

    // ------------------------------------------------------------------
    // 4. Go live — send WhatsApp welcome message + welcome email
    // ------------------------------------------------------------------
    if (body.go_live) {
      // Fetch the clinic to get its subdomain and owner phone
      const { data: clinic } = await supabase
        .from("clinics")
        .select("name, subdomain, phone, owner_name")
        .eq("id", body.clinic_id)
        .single();

      const siteUrl = clinic?.subdomain
        ? `https://${clinic.subdomain}.oltigo.com`
        : "https://oltigo.com";
      const dashboardUrl = `${siteUrl}/admin`;
      const name = clinic?.owner_name || clinic?.name || "Docteur";

      // 4a. WhatsApp welcome message
      if (clinic?.phone) {
        const message =
          `Bienvenue sur Oltigo, ${name} ! \u{1F389}\n\n` +
          `Votre site est maintenant en ligne :\n${siteUrl}\n\n` +
          `Vos patients peuvent prendre rendez-vous d\u00e8s maintenant. ` +
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

      // 4b. Welcome email with getting started guide
      // Fetch the admin's email from the users table (profile only has id/role/clinic_id)
      const { data: adminUser } = await supabase
        .from("users")
        .select("email")
        .eq("id", profile.id)
        .single();
      const adminEmail = adminUser?.email;
      if (adminEmail) {
        try {
          const emailContent = onboardingWelcomeEmail({
            clinicName: clinic?.name || "Votre cabinet",
            adminName: name,
            siteUrl,
            dashboardUrl,
          });
          await sendEmail({
            to: adminEmail,
            subject: emailContent.subject,
            html: emailContent.html,
          });
        } catch (emailErr) {
          logger.warn("Welcome email failed", {
            context: "onboarding/wizard",
            error: emailErr,
          });
          // Non-fatal
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
