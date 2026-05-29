/**
 * Doctor-to-Doctor Referral System API
 *
 * GET    /api/referrals — List referrals (filtered by role: sent/received)
 * POST   /api/referrals — Create a new referral
 * PATCH  /api/referrals — Update referral status (accept/decline/complete)
 *
 * Tracks referred patients and triggers WhatsApp notifications.
 * Requires doctor, clinic_admin, or super_admin role.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { enqueueNotification } from "@/lib/notification-queue";
import type { NotificationTrigger } from "@/lib/notifications";
import { requireTenant } from "@/lib/tenant";
import type { UserRole } from "@/lib/types/database";
import type { Database } from "@/lib/types/database-extended";
import { withAuth, type AuthContext } from "@/lib/with-auth";

type ExtendedClient = SupabaseClient<Database>;

const ALLOWED_ROLES: UserRole[] = ["super_admin", "clinic_admin", "doctor"];

// ── GET — list referrals ──

async function handleGet(request: NextRequest, auth: AuthContext) {
  try {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const supabase = auth.supabase as unknown as ExtendedClient;
    const userId = auth.profile.id;
    const role = auth.profile.role;

    const url = new URL(request.url);
    const direction = url.searchParams.get("direction") ?? "all";

    let query = supabase
      .from("referrals")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });

    if (role === "doctor") {
      if (direction === "sent") {
        query = query.eq("referring_doctor_id", userId);
      } else if (direction === "received") {
        query = query.eq("referred_to_doctor_id", userId);
      } else {
        query = query.or(`referring_doctor_id.eq.${userId},referred_to_doctor_id.eq.${userId}`);
      }
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Failed to fetch referrals", { clinicId, error });
      return apiInternalError();
    }

    return apiSuccess({ referrals: data ?? [] });
  } catch (error) {
    logger.error("Referrals GET failed", { error });
    return apiInternalError();
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);

// ── POST — create a referral ──

const createReferralSchema = z.object({
  referredToDoctorId: z.string().uuid(),
  patientId: z.string().uuid(),
  reason: z.string().min(1).max(1000),
  notes: z.string().max(2000).optional(),
});

async function handlePost(request: NextRequest, auth: AuthContext) {
  try {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const supabase = auth.supabase as unknown as ExtendedClient;

    const body = await request.json();
    const parsed = createReferralSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400, "VALIDATION_ERROR");
    }

    const { referredToDoctorId, patientId, reason, notes } = parsed.data;
    const referringDoctorId = auth.profile.id;

    if (referringDoctorId === referredToDoctorId) {
      return apiError("Cannot refer to yourself", 400, "SELF_REFERRAL");
    }

    const { data: targetDoctor } = await supabase
      .from("users")
      .select("id, name, phone, role")
      .eq("id", referredToDoctorId)
      .eq("clinic_id", clinicId)
      .eq("role", "doctor")
      .single();

    if (!targetDoctor) {
      return apiError("Target doctor not found in this clinic", 404, "DOCTOR_NOT_FOUND");
    }

    const { data: patient } = await supabase
      .from("users")
      .select("id, name, phone")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .single();

    if (!patient) {
      return apiError("Patient not found in this clinic", 404, "PATIENT_NOT_FOUND");
    }

    const { data: referral, error: insertError } = await supabase
      .from("referrals")
      .insert({
        clinic_id: clinicId,
        referring_doctor_id: referringDoctorId,
        referred_to_doctor_id: referredToDoctorId,
        patient_id: patientId,
        reason,
        notes: notes ?? null,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to create referral", { clinicId, error: insertError });
      return apiInternalError();
    }

    if (targetDoctor.phone) {
      try {
        await enqueueNotification({
          clinicId,
          channel: "whatsapp",
          recipient: targetDoctor.phone,
          body: `New patient referral: ${patient.name} has been referred to you. Reason: ${reason}`,
          trigger: "doctor_assigned" as NotificationTrigger,
          metadata: {
            referral_id: referral.id,
            patient_name: patient.name,
          },
        });

        await supabase
          .from("referrals")
          .update({ whatsapp_notified: true })
          .eq("id", referral.id)
          .eq("clinic_id", clinicId);
      } catch (notifError) {
        logger.warn("Failed to send referral notification", {
          referralId: referral.id,
          error: notifError,
        });
      }
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "referral_created",
      type: "patient",
      clinicId,
      actor: referringDoctorId,
      description: `Referred patient ${patient.name} to Dr. ${targetDoctor.name}`,
      metadata: {
        referral_id: referral.id,
        patient_id: patientId,
        referred_to: referredToDoctorId,
        reason,
      },
    });

    return apiSuccess({ referral });
  } catch (error) {
    logger.error("Referrals POST failed", { error });
    return apiInternalError();
  }
}

export const POST = withAuth(handlePost, ALLOWED_ROLES);

// ── PATCH — update referral status ──

const updateReferralSchema = z.object({
  referralId: z.string().uuid(),
  status: z.enum(["accepted", "declined", "completed"]),
  notes: z.string().max(2000).optional(),
});

async function handlePatch(request: NextRequest, auth: AuthContext) {
  try {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const supabase = auth.supabase as unknown as ExtendedClient;

    const body = await request.json();
    const parsed = updateReferralSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400, "VALIDATION_ERROR");
    }

    const { referralId, status, notes } = parsed.data;

    const { data: existing } = await supabase
      .from("referrals")
      .select("*")
      .eq("id", referralId)
      .eq("clinic_id", clinicId)
      .single();

    if (!existing) {
      return apiError("Referral not found", 404, "NOT_FOUND");
    }

    if (auth.profile.role === "doctor" && existing.referred_to_doctor_id !== auth.profile.id) {
      return apiError("Only the receiving doctor can update this referral", 403, "FORBIDDEN");
    }

    const { data: updated, error: updateError } = await supabase
      .from("referrals")
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(notes ? { notes } : {}),
      })
      .eq("id", referralId)
      .eq("clinic_id", clinicId)
      .select()
      .single();

    if (updateError) {
      logger.error("Failed to update referral", { clinicId, referralId, error: updateError });
      return apiInternalError();
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: `referral_${status}`,
      type: "patient",
      clinicId,
      actor: auth.profile.id,
      description: `Referral ${referralId} marked as ${status}`,
      metadata: { referral_id: referralId, new_status: status },
    });

    return apiSuccess({ referral: updated });
  } catch (error) {
    logger.error("Referrals PATCH failed", { error });
    return apiInternalError();
  }
}

export const PATCH = withAuth(handlePatch, ALLOWED_ROLES);
