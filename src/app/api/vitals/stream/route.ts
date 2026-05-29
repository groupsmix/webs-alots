/**
 * GET /api/vitals/stream?patient_id=...
 *
 * SSE endpoint for real-time patient vitals streaming.
 * Uses Supabase Realtime to push new vitals readings to the client.
 *
 * Access: doctor, clinic_admin, super_admin
 * Tenant-scoped: only vitals for the current clinic are streamed.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { requireTenant } from "@/lib/tenant";
import { withAuth, type AuthContext } from "@/lib/with-auth";
import { createVitalsStream } from "@/modules/vitals/stream";

export const GET = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patient_id");

    if (!patientId) {
      return apiError("Paramètre 'patient_id' requis", 400, "MISSING_PATIENT_ID");
    }

    // Verify the patient belongs to this clinic before opening the stream
    const { data: patient, error: patientError } = await auth.supabase
      .from("users")
      .select("id")
      .eq("clinic_id", tenant.clinicId)
      .eq("id", patientId)
      .eq("role", "patient")
      .single();

    if (patientError || !patient) {
      return apiError("Patient non trouvé dans cette clinique", 404, "PATIENT_NOT_FOUND");
    }

    logger.info("Vitals SSE stream opened", {
      context: "vitals-stream",
      clinicId: tenant.clinicId,
      patientId,
    });

    const stream = createVitalsStream(auth.supabase, tenant.clinicId, patientId);

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
  ["super_admin", "clinic_admin", "doctor"],
);
