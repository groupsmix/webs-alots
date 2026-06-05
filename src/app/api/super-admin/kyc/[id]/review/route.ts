/**
 * PATCH /api/super-admin/kyc/:id/review
 *
 * Actions:
 *   approve           → review_status = 'approved', clinic.status = 'trial'
 *   reject            → review_status = 'rejected', rejection_reason required
 *   request_more_docs → review_status = 'pending' with a note in rejection_reason
 *
 * Only super_admin may call this endpoint.
 * Cross-tenant access is intentional here — this is the super-admin review queue.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit-log";
import { getUserProfile } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";

const reviewSchema = z
  .object({
    action: z.enum(["approve", "reject", "request_more_docs"]),
    reason: z.string().max(1000).optional(),
  })
  .refine(
    (d) => d.action !== "reject" || (typeof d.reason === "string" && d.reason.trim().length > 0),
    { message: "Reason is required for rejection", path: ["reason"] },
  );

// clinic_kyc.review_status CHECK: ('pending','approved','rejected')
// request_more_docs maps back to 'pending' with a note in rejection_reason
const STATUS_MAP: Record<string, string> = {
  approve: "approved",
  reject: "rejected",
  request_more_docs: "pending",
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    // Auth — must be super_admin
    const profile = await getUserProfile();
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (profile.role !== "super_admin") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Parse + validate body
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = reviewSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Validation error" },
        { status: 422 },
      );
    }

    const { action, reason } = parsed.data;
    const supabase = await createClient();

    // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant read
    const { data: kyc } = await supabase
      .from("clinic_kyc")
      .select("id, clinic_id, review_status")
      .eq("id", id)
      .maybeSingle();

    if (!kyc) {
      return NextResponse.json({ ok: false, error: "KYC record not found" }, { status: 404 });
    }

    const newStatus = STATUS_MAP[action] ?? "pending";
    const rejectionReason =
      action === "reject"
        ? (reason ?? null)
        : action === "request_more_docs"
          ? `Docs supplémentaires requis${reason ? ` : ${reason}` : ""}`
          : null;

    // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant update
    const { error: updateErr } = await supabase
      .from("clinic_kyc")
      .update({
        review_status: newStatus,
        rejection_reason: rejectionReason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile.id,
      })
      .eq("id", id);

    if (updateErr) {
      logger.error("KYC review update failed", {
        context: "kyc/review",
        kycId: id,
        error: updateErr,
      });
      return NextResponse.json({ ok: false, error: "Failed to update KYC" }, { status: 500 });
    }

    // On approval → move clinic to trial tier
    if (action === "approve" && kyc.clinic_id) {
      // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant update
      await supabase.from("clinics").update({ status: "trial" }).eq("id", kyc.clinic_id);
    }

    await logAuditEvent({
      supabase,
      action: `kyc_${action}`,
      type: "admin",
      clinicId: kyc.clinic_id,
      description: `KYC ${action} for clinic ${kyc.clinic_id} by super_admin ${profile.id}`,
      metadata: { kycId: id, action, reason },
    });

    return NextResponse.json({ ok: true, data: { updated: true } });
  } catch (err) {
    logger.error("KYC review route error", { context: "kyc/review", error: err });
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
