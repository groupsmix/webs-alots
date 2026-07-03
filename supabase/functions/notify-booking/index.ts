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

import { createClient } from "@supabase/supabase-js";

/** UUID v4 format validator */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DISPLAY_TIMEZONE = "Africa/Casablanca";

// ── Startup Assertions ─────────────────────────────────────────────────────

if (!Deno.env.get("EDGE_FUNCTION_SECRET") || Deno.env.get("EDGE_FUNCTION_SECRET")!.length < 32) {
  console.error("FATAL: EDGE_FUNCTION_SECRET is not set or too short (< 32 chars).");
}
if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.length < 32) {
  console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY is not set or too short (< 32 chars).");
}

/**
 * Compares two secrets without leaking length/content via timing.
 * Returns false on length mismatch (token lengths are fixed, so this does
 * not leak meaningful information) and otherwise accumulates byte diffs so
 * the loop always runs to completion.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length === 0 || ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

interface AppointmentRow {
  id: string;
  slot_start: string | null;
  slot_end: string | null;
  status: string;
  patient: { name: string; phone: string | null } | null;
  doctor: { name: string; phone: string | null } | null;
  service: { name: string } | null;
  clinic: { id: string; name: string } | null;
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

    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });
    return resp.ok;
  }

  // Meta WhatsApp Business API
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  if (!phoneNumberId || !accessToken) return false;

  const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
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
  });
  return resp.ok;
}

Deno.serve(async (req: Request) => {
  try {
    // ── Authentication (EDGE-01) ──────────────────────────────────────
    // Verify the request carries a valid Authorization header.
    // Accepts either:
    //   1. The Supabase service-role JWT (for DB webhook triggers)
    //   2. A shared EDGE_FUNCTION_SECRET bearer token (for manual calls)
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const edgeFunctionSecret = Deno.env.get("EDGE_FUNCTION_SECRET") ?? "";

    const isServiceRole = serviceRoleKey !== "" && timingSafeEqual(token, serviceRoleKey);
    const isEdgeSecret = edgeFunctionSecret !== "" && timingSafeEqual(token, edgeFunctionSecret);

    if (!isServiceRole && !isEdgeSecret) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Input validation (EDGE-01) ────────────────────────────────────
    const payload = await req.json();
    const appointmentId = payload.appointmentId || payload.record?.id;
    const clinicId = payload.clinicId || payload.record?.clinic_id;

    if (!appointmentId || typeof appointmentId !== "string" || !UUID_RE.test(appointmentId)) {
      return new Response(JSON.stringify({ error: "appointmentId must be a valid UUID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!clinicId || typeof clinicId !== "string" || !UUID_RE.test(clinicId)) {
      return new Response(JSON.stringify({ error: "clinicId must be a valid UUID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch appointment with related data (include slot_start/slot_end as fallback)
    const { data: appointment, error } = await supabase
      .from("appointments")
      .select(
        "id, slot_start, slot_end, status, patient:users!patient_id(name, phone), doctor:users!doctor_id(name, phone), service:services(name), clinic:clinics(id, name)",
      )
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId)
      .single();

    if (error || !appointment) {
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apt = appointment as unknown as AppointmentRow;
    const results: { recipient: string; sent: boolean }[] = [];

    // Derive display date/time from slot_start, rendered in clinic local timezone.
    let displayDate: string | null = null;
    let displayTime: string | null = null;

    if (apt.slot_start) {
      const slotDt = new Date(apt.slot_start);
      if (!isNaN(slotDt.getTime())) {
        // en-CA formats dates as YYYY-MM-DD.
        displayDate = slotDt.toLocaleDateString("en-CA", { timeZone: DISPLAY_TIMEZONE });
        displayTime = slotDt.toLocaleTimeString("fr-MA", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: DISPLAY_TIMEZONE,
        });
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

    return new Response(JSON.stringify({ status: "notifications_sent", results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
