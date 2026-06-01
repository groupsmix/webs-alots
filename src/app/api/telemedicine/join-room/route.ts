/**
 * POST /api/telemedicine/join-room
 *
 * Generates a short-lived Twilio Access Token for a participant (doctor or patient)
 * to join an existing telemedicine video room.
 *
 * Body: { session_id: string }
 * Returns: { token: string, room_name: string, identity: string }
 */

import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { generateVideoToken } from "@/lib/video/client";

const joinRoomSchema = z.object({
  session_id: z.string().uuid(),
});

// All authenticated users can join (doctors AND patients)
const ALLOWED_ROLES = ["super_admin", "clinic_admin", "receptionist", "doctor", "patient"] as const;

export const POST = withAuthValidation(
  joinRoomSchema,
  async (body, _request, { supabase, profile }) => {
    const { session_id } = body;

    // Build a query — patients can only join their own sessions
    let query = supabase
      // nosemgrep: tenant-scoping
      .from("telemedicine_sessions")
      .select("id, status, room_url, patient_id, doctor_id, clinic_id")
      .eq("id", session_id);

    // For non-super_admin, always scope to clinic
    if (profile.clinic_id) {
      query = query.eq("clinic_id", profile.clinic_id);
    }

    // Patients can only join their own session
    if (profile.role === "patient") {
      query = query.eq("patient_id", profile.id);
    }

    const { data: session, error: sessionError } = await query.single();

    if (sessionError || !session) {
      return apiError("Session de télémédecine non trouvée ou accès refusé", 404, "NOT_FOUND");
    }

    if (!session.room_url) {
      return apiError("La salle vidéo n'a pas encore été créée. Contactez le médecin.", 409, "ROOM_NOT_READY");
    }

    if (session.status === "completed" || session.status === "cancelled") {
      return apiError("Cette session est terminée ou annulée", 400, "INVALID_STATUS");
    }

    // Determine identity: "doctor-<id>" or "patient-<id>"
    const identity = `${profile.role}-${profile.id}`;
    const roomName = `oltigo-session-${session_id}`;

    let token: string;
    try {
      token = await generateVideoToken({
        identity,
        roomName,
        ttlSeconds: 7200, // 2 hours
      });
    } catch (err) {
      logger.error("Échec de génération du token vidéo", {
        context: "telemedicine/join-room",
        session_id,
        error: err,
      });
      return apiError("Échec de génération du token vidéo", 502, "VIDEO_PROVIDER_ERROR");
    }

    await logAuditEvent({
      supabase,
      action: "telemedicine.room_joined",
      type: "patient",
      clinicId: session.clinic_id,
      actor: profile.id,
      description: `Participant ${identity} a rejoint la session ${session_id}`,
      metadata: { session_id, identity, role: profile.role },
    });

    return apiSuccess({
      token,
      room_name: roomName,
      identity,
      room_url: session.room_url,
    });
  },
  [...ALLOWED_ROLES],
);
