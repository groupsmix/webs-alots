/**
 * GET/POST /api/clinic-owner/patient-acquisition
 *
 * Track patient acquisition channels and cost per patient.
 * Requires clinic_admin role.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError, apiSupabaseError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/types/database";
import type { Database } from "@/lib/types/database-extended";
import { patientAcquisitionCreateSchema } from "@/lib/validations/clinic-owner";
import { safeParse } from "@/lib/validations/helpers";
import { withAuth, type AuthContext } from "@/lib/with-auth";

type ExtendedClient = SupabaseClient<Database>;

const ALLOWED_ROLES: UserRole[] = ["clinic_admin"];

async function handleGet(_request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const [channelsRes, campaignsRes, patientsRes] = await Promise.all([
      supabase.from("patient_acquisition_channels").select("*").eq("clinic_id", clinicId),
      supabase
        .from("marketing_campaigns")
        .select("id, name, channel, spend, budget, status")
        .eq("clinic_id", clinicId),
      supabase
        .from("users")
        .select("id, created_at")
        .eq("clinic_id", clinicId)
        .eq("role", "patient"),
    ]);

    const channels = channelsRes.data ?? [];
    const campaigns = campaignsRes.data ?? [];
    const patients = patientsRes.data ?? [];

    const channelBreakdown: Record<string, { count: number; spend: number }> = {};
    const channelTypes = [
      "whatsapp",
      "google",
      "facebook",
      "instagram",
      "referral",
      "walk_in",
      "website",
      "other",
    ];

    for (const ch of channelTypes) {
      channelBreakdown[ch] = { count: 0, spend: 0 };
    }

    for (const acq of channels) {
      const ch = acq.channel as string;
      if (channelBreakdown[ch]) {
        channelBreakdown[ch].count += 1;
      }
    }

    for (const camp of campaigns) {
      const ch = camp.channel as string;
      if (channelBreakdown[ch]) {
        channelBreakdown[ch].spend += typeof camp.spend === "number" ? camp.spend : 0;
      }
    }

    const channelStats = Object.entries(channelBreakdown).map(([channel, stats]) => ({
      channel,
      patientCount: stats.count,
      totalSpend: stats.spend,
      costPerPatient: stats.count > 0 ? Math.round(stats.spend / stats.count) : 0,
    }));

    const totalSpend = channelStats.reduce((sum, c) => sum + c.totalSpend, 0);
    const totalTrackedPatients = channelStats.reduce((sum, c) => sum + c.patientCount, 0);
    const overallCostPerPatient =
      totalTrackedPatients > 0 ? Math.round(totalSpend / totalTrackedPatients) : 0;

    return apiSuccess({
      channels: channelStats,
      campaigns,
      summary: {
        totalPatients: patients.length,
        trackedPatients: totalTrackedPatients,
        untrackedPatients: patients.length - totalTrackedPatients,
        totalMarketingSpend: totalSpend,
        overallCostPerPatient,
      },
    });
  } catch (err) {
    logger.error("Failed to fetch patient acquisition", {
      context: "clinic-owner/patient-acquisition",
      error: err,
    });
    return apiInternalError("Failed to fetch patient acquisition data");
  }
}

async function handlePost(request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile, user } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const body = await request.json();
    const parsed = safeParse(patientAcquisitionCreateSchema, body);
    if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

    const { patient_id, channel, campaign_id, referral_source, notes } = parsed.data;

    const { data, error } = await supabase
      .from("patient_acquisition_channels")
      .insert({
        clinic_id: clinicId,
        patient_id,
        channel,
        campaign_id: campaign_id ?? null,
        referral_source: referral_source ?? null,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) return apiSupabaseError(error, "patient-acquisition/create");

    await logAuditEvent({
      supabase,
      action: "patient_acquisition_tracked",
      type: "admin",
      clinicId,
      actor: user.id,
      description: `Patient ${patient_id} acquired via ${channel}`,
    });

    return apiSuccess({ acquisition: data }, 201);
  } catch (err) {
    logger.error("Failed to track patient acquisition", {
      context: "clinic-owner/patient-acquisition",
      error: err,
    });
    return apiInternalError("Failed to track patient acquisition");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const POST = withAuth(handlePost, ALLOWED_ROLES);
