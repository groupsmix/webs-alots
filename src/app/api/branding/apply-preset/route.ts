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
 * 3. Updates clinic's section_visibility: which sections are ON/OFF
 * 4. Returns success + the applied preset details
 *
 * Auth: Requires clinic_admin or super_admin role
 * Tenant: Scoped to current clinic_id
 */

import { revalidatePath } from "next/cache";
import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
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
  };

  const { error } = await supabase
    .from("clinics")
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
  });
}, ADMIN_ROLES);
