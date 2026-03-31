/**
 * Supabase Edge Function: notify-booking
 *
 * Triggered when a new appointment is created.
 * Sends WhatsApp notifications to:
 *   - Patient (booking confirmation)
 *   - Doctor (new appointment alert)
 *   - Receptionist (new booking notification via in-app)
 *
 * Invoke via Supabase DB webhook or manual call:
 *   POST /functions/v1/notify-booking
 *   Body: { "appointmentId": "uuid" }
 *
 * Required env vars (set in Supabase Dashboard > Edge Functions):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   WHATSAPP_PROVIDER (meta | twilio)
 *   WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN (for Meta)
 *   TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM (for Twilio)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** UUID v4 format validator */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AppointmentRow {
  id: string;
  appointment_date: string | null;
  start_time: string | null;
  slot_start: string | null;
  slot_end: string | null;
  status: string;
  patient: { name: string; phone: string | null } | null;
  doctor: { name: string; phone: string | null } | null;
  service: { name: string } | null;
  clinic: { id: string; name: string; owner_phone: string | null } | null;
}

async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  const provider = Deno.env.get("WHATSAPP_PROVIDER") || "meta";

  if (provider === "twilio") {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_WHATSAPP_FROM");
    if (!sid || !token || !from) return false;

    const formData = new URLSearchParams();
    formData.append("From", `whatsapp:${from}`);
    formData.append("To", `whatsapp:${to}`);
    formData.append("Body", body);

    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      },
    );
    return resp.ok;
  }

  // Meta WhatsApp Business API
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  if (!phoneNumberId || !accessToken) return false;

  const resp = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    },
  );
  return resp.ok;
}

serve(async (req: Request) => {
  try {
    // ── Authentication (EDGE-01) ──────────────────────────────────────
    // Verify the request carries a valid Authorization header.
    // Accepts either:
    //   1. The Supabase service-role JWT (for DB webhook triggers)
    //   2. A shared EDGE_FUNCTION_SECRET bearer token (for manual calls)
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const edgeFunctionSecret = Deno.env.get("EDGE_FUNCTION_SECRET") ?? "";

    const isServiceRole = serviceRoleKey && token === serviceRoleKey;
    const isEdgeSecret = edgeFunctionSecret && token === edgeFunctionSecret;

    if (!isServiceRole && !isEdgeSecret) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── Input validation (EDGE-01) ────────────────────────────────────
    const { appointmentId } = await req.json();

    if (!appointmentId || typeof appointmentId !== "string" || !UUID_RE.test(appointmentId)) {
      return new Response(
        JSON.stringify({ error: "appointmentId must be a valid UUID" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch appointment with related data (include slot_start/slot_end as fallback)
    const { data: appointment, error } = await supabase
      .from("appointments")
      .select(
        "id, appointment_date, start_time, slot_start, slot_end, status, patient:users!patient_id(name, phone), doctor:users!doctor_id(name, phone), service:services(name), clinic:clinics(id, name, owner_phone)",
      )
      .eq("id", appointmentId)
      .single();

    if (error || !appointment) {
      return new Response(
        JSON.stringify({ error: "Appointment not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const apt = appointment as unknown as AppointmentRow;
    const results: { recipient: string; sent: boolean }[] = [];

    // Derive display date/time, falling back to slot_start when
    // appointment_date or start_time are NULL.
    let displayDate = apt.appointment_date;
    let displayTime = apt.start_time;

    if ((!displayDate || !displayTime) && apt.slot_start) {
      const slotDt = new Date(apt.slot_start);
      if (!isNaN(slotDt.getTime())) {
        displayDate = displayDate ?? slotDt.toISOString().split("T")[0];
        displayTime = displayTime ?? slotDt.toISOString().split("T")[1]?.slice(0, 5) ?? null;
      }
    }

    const dateStr = displayDate ?? "TBD";
    const timeStr = displayTime ?? "TBD";

    // Send confirmation to patient
    if (apt.patient?.phone) {
      const body = `Hello ${apt.patient.name}, your appointment with ${apt.doctor?.name ?? "our doctor"} is confirmed for ${dateStr} at ${timeStr}. Service: ${apt.service?.name ?? "N/A"}. — ${apt.clinic?.name ?? ""}`;
      const sent = await sendWhatsApp(apt.patient.phone, body);
      results.push({ recipient: "patient", sent });
    }

    // Notify doctor
    if (apt.doctor?.phone) {
      const body = `New appointment: ${apt.patient?.name ?? "A patient"} on ${dateStr} at ${timeStr}. Service: ${apt.service?.name ?? "N/A"}.`;
      const sent = await sendWhatsApp(apt.doctor.phone, body);
      results.push({ recipient: "doctor", sent });
    }

    // Notify clinic via in-app notification
    if (apt.clinic?.id) {
      // Look up the clinic admin to use as the notification recipient
      const { data: clinicAdmin, error: adminError } = await supabase
        .from("users")
        .select("id")
        .eq("clinic_id", apt.clinic.id)
        .eq("role", "clinic_admin")
        .limit(1)
        .single();

      if (adminError || !clinicAdmin?.id) {
        console.error(
          `[notify-booking] No clinic_admin found for clinic ${apt.clinic.id}:`,
          adminError?.message ?? "no matching user",
        );
      } else {
        const { error: insertError } = await supabase.from("notifications").insert({
          user_id: clinicAdmin.id,
          clinic_id: apt.clinic.id,
          type: "new_booking",
          channel: "in_app",
          title: "New Appointment Booked",
          body: `${apt.patient?.name ?? "A patient"} booked with ${apt.doctor?.name ?? "a doctor"} on ${dateStr} at ${timeStr}.`,
          is_read: false,
        });

        if (insertError) {
          console.error("[notify-booking] Failed to insert notification:", insertError.message);
        } else {
          results.push({ recipient: "clinic_notification", sent: true });
        }
      }
    }

    return new Response(
      JSON.stringify({ status: "notifications_sent", results }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
