/**
 * POST /api/telemedicine/create-room
 *
 * Creates a Twilio video room for an existing telemedicine session
 * and updates the session's room_url with the Twilio room identifier.
 *
 * Body: { session_id: string }
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createVideoRoom } from "@/lib/video/client";
import { withAuthValidation } from "@/lib/api-validate";
import { STAFF_ROLES } from "@/lib/auth-roles";

const createRoomSchema = z.object({
  session_id: z.string().uuid(),
});

export const POST = withAuthValidation(
  createRoomSchema,
  async (body, _request, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiError("Contexte clinique requis", 403);

    const { session_id } = body;

    // Verify the session belongs to this clinic (tenant scoping)
    const { data: session, error: sessionError } = await supabase
      // nosemgrep: tenant-scoping
      .from("telemedicine_sessions")
      .select("id, status, room_url, patient_id, doctor_id")
      .eq("clinic_id", clinicId)
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return apiError("Session de télémédecine non trouvée", 404, "NOT_FOUND");
    }

    if (session.status === "completed" || session.status === "cancelled") {
      return apiError("Impossible de créer une salle pour une session terminée ou annulée", 400, "INVALID_STATUS");
    }

    // Create (or retrieve) the Twilio video room
    let room;
    try {
      room = await createVideoRoom(session_id);
    } catch (err) {
      logger.error("Échec de création de la salle vidéo", {
        context: "telemedicine/create-room",
        session_id,
        error: err,
      });
      return apiError("Échec de création de la salle vidéo", 502, "VIDEO_PROVIDER_ERROR");
    }

    // Update the session with the real room URL
    const roomUrl = `https://meet.twilio.com/${room.uniqueName}`;
    const { data: updatedSession, error: updateError } = await supabase
      // nosemgrep: tenant-scoping
      .from("telemedicine_sessions")
      .update({
        room_url: roomUrl,
        status: "in_progress",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("clinic_id", clinicId)
      .eq("id", session_id)
      .select()
      .single();

    if (updateError || !updatedSession) {
      logger.error("Échec de mise à jour de la session", {
        context: "telemedicine/create-room",
        session_id,
        error: updateError,
      });
      return apiError("Échec de mise à jour de la session", 500);
    }

    await logAuditEvent({
      supabase,
      action: "telemedicine.room_created",
      type: "patient",
      clinicId,
      actor: profile.id,
      description: `Salle vidéo créée pour la session ${session_id}`,
      metadata: {
        session_id,
        room_name: room.uniqueName,
        room_sid: room.sid,
      },
    });

    return apiSuccess({
      session: updatedSession,
      room: {
        sid: room.sid,
        name: room.uniqueName,
        url: roomUrl,
      },
    });
  },
  STAFF_ROLES,
);
