/**
 * Supabase Edge Function: send-appointment-reminders
 *
 * Triggered every 15 minutes by the pg_cron job created in migration 00147.
 * For each reminder window (T-24h, T-2h, T-15min):
 *   1. Finds confirmed appointments whose slot_start falls inside the window.
 *   2. Skips appointments that already have a reminder_type entry in
 *      appointment_reminders (deduplication via unique constraint).
 *   3. Sends a WhatsApp template message using the clinic's own phone number
 *      ID and access token (per-tenant credentials from the server-only
 *      clinic_whatsapp_credentials table — never exposed to user-scoped queries).
 *   4. Inserts a row into appointment_reminders to prevent re-sending.
 *
 * Required env vars on the Edge Function (Dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL              — auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase
 *   CRON_SECRET               — shared secret for pg_cron / external trigger
 *                               (set via `supabase secrets set CRON_SECRET=...`)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────

interface Clinic {
  name: string;
  whatsapp_phone_id: string | null;
  config: { locale?: string } | null;
}

interface Appointment {
  id: string;
  clinic_id: string;
  slot_start: string;
  patient: { name: string; phone: string | null } | null;
  doctor: { name: string } | null;
  clinic: Clinic | null;
}

interface ReminderWindow {
  type: "24h" | "2h" | "15min";
  minutesBefore: number;
  template: string;
}

// ── Config ─────────────────────────────────────────────────────────────────

const META_API_BASE = "https://graph.facebook.com/v21.0";

/** Each reminder fires inside a ±7-minute window around the target time. */
const WINDOW_TOLERANCE_MS = 7 * 60 * 1_000;

const REMINDER_WINDOWS: ReminderWindow[] = [
  { type: "24h", minutesBefore: 24 * 60, template: "appointment_reminder_24h" },
  { type: "2h", minutesBefore: 2 * 60, template: "appointment_reminder_2h" },
  { type: "15min", minutesBefore: 15, template: "appointment_reminder_15min" },
];

// ── Startup Assertions ─────────────────────────────────────────────────────

if (!Deno.env.get("CRON_SECRET") || Deno.env.get("CRON_SECRET")!.length < 32) {
  console.error("FATAL: CRON_SECRET is not set or too short (< 32 chars).");
}
if (
  !Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.length < 32
) {
  console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY is not set or too short (< 32 chars).");
}

// ── WhatsApp helper ────────────────────────────────────────────────────────

async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  bodyParams: string[],
  locale: string = "fr",
): Promise<string | null> {
  const res = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: locale },
        components:
          bodyParams.length > 0
            ? [
                {
                  type: "body",
                  parameters: bodyParams.map((text) => ({ type: "text", text })),
                },
              ]
            : [],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("WhatsApp API error", { status: res.status, error: err });
    return null;
  }

  const data = await res.json();
  return data.messages?.[0]?.id ?? null;
}

// ── Token cache (per-invocation) ───────────────────────────────────────────

/** Fetches the WhatsApp access token for a clinic from the server-only
 *  `clinic_whatsapp_credentials` table. Returns null if no creds exist. */
async function getClinicWhatsAppToken(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("clinic_whatsapp_credentials")
    .select("whatsapp_access_token")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch clinic whatsapp credentials", { clinicId, error });
    return null;
  }
  return data?.whatsapp_access_token ?? null;
}

// ── Constant-time secret comparison (EDGE-01 hardening) ─────────────────────

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

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // ── Authentication (EDGE-01) ──────────────────────────────────────
  // Verify the request carries a valid Authorization header.
  // Accepts either:
  //   1. The Supabase service-role JWT (for DB webhook triggers)
  //   2. A shared CRON_SECRET bearer token (for pg_cron / manual calls)
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";

  const isServiceRole = serviceRoleKey !== "" && timingSafeEqual(token, serviceRoleKey);
  const isCronSecret = cronSecret !== "" && timingSafeEqual(token, cronSecret);

  if (!isServiceRole && !isCronSecret) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Supabase Client ──────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 503 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date();
  let totalProcessed = 0;

  // Cache WhatsApp tokens per clinic for this invocation so we don't
  // hit the credentials table once per appointment.
  const tokenCache = new Map<string, string | null>();

  for (const window of REMINDER_WINDOWS) {
    const targetMs = now.getTime() + window.minutesBefore * 60_000;
    const rangeStart = new Date(targetMs - WINDOW_TOLERANCE_MS).toISOString();
    const rangeEnd = new Date(targetMs + WINDOW_TOLERANCE_MS).toISOString();

    // Fetch confirmed appointments in the target window.
    // Deduplication against already-sent reminders is done below with a
    // separate appointment_reminders lookup + in-memory Set (see alreadySent).
    // Token is loaded separately from the server-only credentials table.
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(
        `
        id,
        clinic_id,
        slot_start,
        patient:users!patient_id ( name, phone ),
        doctor:users!doctor_id   ( name ),
        clinic:clinics (
          name,
          whatsapp_phone_id,
          config
        )
      `,
      )
      .eq("status", "confirmed")
      .gte("slot_start", rangeStart)
      .lte("slot_start", rangeEnd);

    if (error) {
      console.error("Failed to fetch appointments for reminder window", {
        window: window.type,
        error,
      });
      continue;
    }

    if (!appointments?.length) continue;

    // Load already-sent reminders for this window to avoid re-sending.
    // supabase-js mis-infers these to-one (`!patient_id`) joins as arrays;
    // the runtime rows are object-shaped, so cast through `unknown` to the
    // Appointment shape that models reality. See send query above.
    const rows = appointments as unknown as Appointment[];
    const appointmentIds = rows.map((a) => a.id);
    const { data: alreadySent } = await supabase
      .from("appointment_reminders")
      .select("appointment_id")
      .eq("reminder_type", window.type)
      .in("appointment_id", appointmentIds);

    const alreadySentIds = new Set(
      (alreadySent ?? []).map((r: { appointment_id: string }) => r.appointment_id),
    );

    for (const appt of rows) {
      if (alreadySentIds.has(appt.id)) continue;

      const clinic = appt.clinic;
      if (!clinic?.whatsapp_phone_id) {
        console.warn("Clinic has no WhatsApp phone number — skipping reminder", {
          clinicId: appt.clinic_id,
          appointmentId: appt.id,
        });
        continue;
      }

      let accessToken = tokenCache.get(appt.clinic_id);
      if (accessToken === undefined) {
        accessToken = await getClinicWhatsAppToken(supabase, appt.clinic_id);
        tokenCache.set(appt.clinic_id, accessToken);
      }

      if (!accessToken) {
        console.warn("Clinic has no WhatsApp access token — skipping reminder", {
          clinicId: appt.clinic_id,
          appointmentId: appt.id,
        });
        continue;
      }

      const patient = appt.patient;
      if (!patient?.phone) {
        console.warn("Patient has no phone — skipping reminder", {
          appointmentId: appt.id,
        });
        continue;
      }

      const scheduled = new Date(appt.slot_start);
      const dateStr = scheduled.toLocaleDateString("fr-MA", {
        timeZone: "Africa/Casablanca",
      });
      const timeStr = scheduled.toLocaleTimeString("fr-MA", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Casablanca",
      });

      const locale = clinic.config?.locale ?? "fr";

      const waMessageId = await sendTemplateMessage(
        clinic.whatsapp_phone_id,
        accessToken,
        patient.phone,
        window.template,
        [patient.name, appt.doctor?.name ?? "", dateStr, timeStr, clinic.name],
        locale,
      );

      // Only record the deduplication row when the message was actually
      // accepted by the WhatsApp API (a message id was returned). On a
      // transient send failure sendTemplateMessage returns null; writing a
      // dedup row here would permanently mark the reminder as "sent" and
      // suppress every future retry, silently dropping the patient's
      // reminder. Skipping the insert lets a subsequent cron run (while the
      // appointment is still inside the ±window tolerance) retry the send.
      if (!waMessageId) {
        console.warn("WhatsApp reminder send failed — will retry on next run", {
          appointmentId: appt.id,
          reminderType: window.type,
        });
        continue;
      }

      // Insert deduplication record — ignore if unique constraint fires
      // (e.g. two parallel invocations racing within the same window).
      const { error: insertErr } = await supabase.from("appointment_reminders").insert({
        appointment_id: appt.id,
        clinic_id: appt.clinic_id,
        reminder_type: window.type,
        wa_message_id: waMessageId,
      });

      if (insertErr && insertErr.code !== "23505") {
        console.error("Failed to insert reminder record", {
          appointmentId: appt.id,
          error: insertErr,
        });
      } else {
        totalProcessed++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed }), {
    headers: { "Content-Type": "application/json" },
  });
});
