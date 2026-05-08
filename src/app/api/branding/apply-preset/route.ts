/**
 * POST /api/branding/apply-preset
 *
 * One-click apply a template preset to the current clinic.
 *
 * Body: { presetId: "beauty-elegant" }
 *
 * What it does:
 * 1. Looks up preset from TEMPLATE_PRESETS
 * 2. Updates clinic's branding record: template_id, primary_color, secondary_color
 * 3. Updates clinic's website_config: hero title, subtitle
 * 4. Updates clinic's section_visibility: which sections are ON/OFF
 * 5. If defaultServices provided, seeds default services for the clinic
 * 6. Returns success + the applied preset details
 *
 * Auth: Requires clinic_admin or super_admin role
 * Tenant: Scoped to current clinic_id
 */

import { revalidatePath } from "next/cache";
import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { getDefaultServices } from "@/lib/config/default-services";
import { logger } from "@/lib/logger";
import { invalidateAllSubdomainCaches } from "@/lib/subdomain-cache";
import { getPreset } from "@/lib/template-presets";
import { requireTenant } from "@/lib/tenant";
import type { UserRole } from "@/lib/types/database";
import { applyPresetSchema } from "@/lib/validations";

const ADMIN_ROLES: UserRole[] = ["super_admin", "clinic_admin"];

export const POST = withAuthValidation(applyPresetSchema, async (body, _request, { supabase }) => {
  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;

  const preset = getPreset(body.presetId);
  if (!preset) {
    return apiError("Preset not found", 404, "PRESET_NOT_FOUND");
  }

  // Build the update payload for the clinics table
  const updates: Record<string, unknown> = {
    template_id: preset.templateId,
    primary_color: preset.theme.primaryColor,
    secondary_color: preset.theme.secondaryColor,
    section_visibility: preset.sections,
    website_config: {
      hero: {
        title: preset.hero.title,
        titleAr: preset.hero.titleAr,
        subtitle: preset.hero.subtitle,
        subtitleAr: preset.hero.subtitleAr,
      },
    },
  };

  const { error } = await supabase
    .from("clinics")
    // @ts-expect-error -- Supabase generated types lag behind actual DB schema
    .update(updates)
    .eq("id", clinicId);

  if (error) {
    logger.warn("Failed to apply preset", {
      context: "branding/apply-preset",
      presetId: body.presetId,
      clinicId,
      error,
    });
    return apiInternalError("Failed to apply preset");
  }

  // Seed default services if the preset specifies a service key
  let seededServices = 0;
  if (preset.defaultServices) {
    const defaults = getDefaultServices(preset.defaultServices);
    if (defaults.length > 0) {
      // Only seed if the clinic has no services yet to avoid duplicates
      const { data: existing } = await supabase
        .from("services")
        .select("id")
        .eq("clinic_id", clinicId)
        .limit(1);

      if (!existing || existing.length === 0) {
        const rows = defaults.map((svc) => ({
          clinic_id: clinicId,
          name: svc.name,
          duration_minutes: svc.duration_minutes,
          price: svc.price,
        }));

        const { error: svcError } = await supabase
          .from("services")
          .insert(rows);

        if (svcError) {
          logger.warn("Failed to seed default services", {
            context: "branding/apply-preset",
            presetId: body.presetId,
            clinicId,
            error: svcError,
          });
          // Non-fatal: preset is still applied even if service seeding fails
        } else {
          seededServices = rows.length;
        }
      }
    }
  }

  // Invalidate caches so the public site picks up the change immediately
  revalidatePath("/", "layout");
  invalidateAllSubdomainCaches();

  return apiSuccess({
    applied: true,
    preset: {
      id: preset.id,
      name: preset.name,
      templateId: preset.templateId,
      theme: preset.theme,
    },
    seededServices,
  });
}, ADMIN_ROLES);
