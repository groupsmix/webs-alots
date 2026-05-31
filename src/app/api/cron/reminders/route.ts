import { NextRequest } from "next/server";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { assertClinicId } from "@/lib/assert-tenant";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import { substituteVariables, defaultNotificationTemplates } from "@/lib/notifications";
import { withSentryCron } from "@/lib/sentry-cron";
// B-02: Cron jobs run without user session cookies, so the cookie-based
// `createClient()` would execute queries as anon under RLS, returning 0
// rows and silently skipping all reminders. Use `createAdminClient("cron")`
// (service-role) which bypasses RLS, then iterate per-clinic.
import { createAdminClient } from "@/lib/supabase-server";
import { APPOINTMENT_STATUS } from "@/lib/types/database";
import { getLocalDateStr } from "@/lib/utils";
import { sendInteractiveMessage } from "@/lib/whatsapp";
import { getWorkerBinding } from "@/lib/cf-bindings";

/**
 * A77-F1: Per-run appointment limit to prevent hitting the 15-minute Cron
 * Trigger wall-time limit mid-fan-out on high-volume days.
 *
 * The cron persists the last processed slot_start value in KV so the
 * next 30-minute invocation resumes from that cursor instead of re-scanning
 * from the beginning. This makes the fan-out O(batch) per invocation, not
 * O(total patients on that day).
 */
const MAX_APPOINTMENTS_PER_RUN = 2_000;
const CRON_CURSOR_KEY = "cron:reminders:last_slot_start";

/**
 * GET /api/cron/reminders
 *
 * Automated appointment reminder endpoint.
 * Called by the Cloudflare Worker scheduled handler (see worker-cron-handler.ts)
 * every 30 minutes via the cron triggers defined in wrangler.toml.
 *
 * Sends two types of reminders:
 * - reminder_24h: For appointments happening in the next 24 hours
 * - reminder_1h: For appointments happening in the next 1 hour
 *
 * Protected by CRON_SECRET via Authorization: Bearer header.
 */
async function handler(request: NextRequest) {
  // DRY: Use shared cron secret verification helper
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient("cron");
    // Quick check to see if there are any active clinics to avoid unnecessary DB queries
    // MA-04: exclude soft-deleted clinics
    const { count: activeClinicsCount } = await supabase
      .from("clinics")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null);

    if (!activeClinicsCount) {
      return apiSuccess({ message: "No active clinics found, skipping cron", sent: 0 });
    }

    const now = new Date();

    // Calculate time windows
    const _twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // FIX (MED-05): Use ISO timestamp range filtering instead of date-string
    // filtering. Date-string filtering (e.g. appointment_date.in.(today,tomorrow))
    // misses appointments near timezone boundaries because the server's UTC date
    // may differ from the clinic's local date.
    const nowISO = now.toISOString();
    const twentyFourHoursISO = twentyFourHoursFromNow.toISOString();

    // A77-F1: Read the KV resume cursor from the previous run.
    // If a cursor exists, we skip appointments already processed in a prior
    // invocation and resume from where we left off. The cursor is a slot_start
    // ISO timestamp stored as an opaque string.
    let resumeCursor: string | null = null;
    try {
      const kv = await getWorkerBinding<KVNamespace>("RATE_LIMIT_KV");
      if (kv) {
        resumeCursor = await kv.get(CRON_CURSOR_KEY);
        // If the stored cursor is older than 2 hours (outside our processing
        // window), discard it and start fresh.
        if (resumeCursor && new Date(resumeCursor) < now) {
          resumeCursor = null;
          await kv.delete(CRON_CURSOR_KEY);
        }
      }
    } catch {
      // KV unavailable — proceed without cursor (process from start)
      logger.warn("reminders cron: KV unavailable for cursor read — processing from start", {
        context: "cron/reminders",
      });
    }

    // AUDIT FINDING #12: Cursor-based pagination instead of .limit(500).
    // At 10x scale (5,000+ appointments/day), the hard limit silently drops
    // reminders. Iterate with cursor-based pagination using slot_start order
    // to drain the full backlog.
    const PAGE_SIZE = 500;
    const SELECT_COLS = `
      id,
      clinic_id,
      patient_id,
      doctor_id,
      appointment_date,
      start_time,
      slot_start,
      slot_end,
      status,
      notes,
      patients:patient_id (id, name, phone),
      doctors:doctor_id (id, name),
      services:service_id (name),
      clinics:clinic_id (name)
    ` as const;

    // First page to infer the row type.
    // A77-F1: If a KV resume cursor exists, start from that point.
    const firstQuery = supabase
      .from("appointments")
      .select(SELECT_COLS)
      .in("status", [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.PENDING])
      .or(`slot_start.gte.${nowISO},slot_start.lte.${twentyFourHoursISO}`)
      .order("slot_start", { ascending: true })
      .limit(PAGE_SIZE)
      // If we have a resume cursor from the previous run, skip ahead.
      ...(resumeCursor ? [supabase.from("appointments").select("").gt("slot_start", resumeCursor)] : []);

    // Note: PostgREST chaining pattern — apply gt() filter if cursor exists
    const baseQuery = (() => {
      const q = supabase
        .from("appointments")
        .select(SELECT_COLS)
        .in("status", [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.PENDING])
        .or(`slot_start.gte.${nowISO},slot_start.lte.${twentyFourHoursISO}`)
        .order("slot_start", { ascending: true })
        .limit(PAGE_SIZE);
      return resumeCursor ? q.gt("slot_start", resumeCursor) : q;
    })();
    void firstQuery; // suppress unused warning — replaced by baseQuery
    // A77-F1: Resume from the last cursor if available
    if (resumeCursor) {
      firstQuery = firstQuery.gt("slot_start", resumeCursor);
    }

    const { data: firstPage, error: firstError } = await baseQuery;

    if (firstError) {
      logger.warn("Failed to send reminder batch", {
        context: "cron/reminders",
        error: firstError,
      });
      return apiInternalError("Failed to query appointments");
    }

    type AppointmentRow = NonNullable<typeof firstPage>[number];
    const appointments: AppointmentRow[] = firstPage ? [...firstPage] : [];

    // Continue paginating if the first page was full AND we haven't hit the per-run limit
    if (firstPage && firstPage.length === PAGE_SIZE) {
      let cursor: string | null =
        (firstPage[firstPage.length - 1] as AppointmentRow).slot_start ?? null;
      let hasMore = true;

      while (hasMore && cursor && appointments.length < MAX_APPOINTMENTS_PER_RUN) {
        const { data: page, error } = await supabase
          .from("appointments")
          .select(SELECT_COLS)
          .in("status", [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.PENDING])
          .or(`slot_start.gte.${nowISO},slot_start.lte.${twentyFourHoursISO}`)
          .order("slot_start", { ascending: true })
          .gt("slot_start", cursor)
          .limit(PAGE_SIZE);

        if (error) {
          logger.warn("Failed to send individual reminder", { context: "cron/reminders", error });
          return apiInternalError("Failed to query appointments");
        }

        if (!page || page.length === 0) {
          hasMore = false;
        } else {
          // A77-F1: Don't exceed the per-run limit to prevent hitting wall-clock timeout
          const remainingBudget = MAX_APPOINTMENTS_PER_RUN - appointments.length;
          appointments.push(...page.slice(0, remainingBudget));

          if (page.length < PAGE_SIZE || appointments.length >= MAX_APPOINTMENTS_PER_RUN) {
            hasMore = false;
          } else {
            cursor = (page[page.length - 1] as AppointmentRow).slot_start ?? null;
          }
        }
      }
    }

    if (!appointments || appointments.length === 0) {
      return apiSuccess({ message: "No upcoming appointments", sent: 0 });
    }

    // --- Batch idempotency check (avoids N+1 queries) ---
    // Fetch already-sent reminder logs in chunks of 500 to avoid exceeding
    // PostgREST URL-length limits at scale (PERF-002).
    const appointmentIds = appointments.map((a) => a.id);
    const CHUNK_SIZE = 500;
    const allSentLogs: { appointment_id: string | null; trigger: string }[] = [];
    for (let i = 0; i < appointmentIds.length; i += CHUNK_SIZE) {
      const chunk = appointmentIds.slice(i, i + CHUNK_SIZE);
      const { data: sentLogs } = await supabase
        .from("notification_log")
        .select("appointment_id, trigger")
        .in("appointment_id", chunk)
        .eq("channel", "reminder")
        .eq("status", "sent");
      if (sentLogs) allSentLogs.push(...sentLogs);
    }

    const alreadySent = new Set(allSentLogs.map((l) => `${l.appointment_id}:${l.trigger}`));

    // Clinic names are now joined in the main appointment query above
    // (clinics:clinic_id (name)), so no separate lookup is needed.

    const results: { appointmentId: string; type: string; success: boolean }[] = [];
    const pendingLogInserts: {
      appointment_id: string;
      trigger: string;
      channel: string;
      status: string;
      clinic_id: string;
      recipient_name: string;
      recipient_phone: string;
    }[] = [];

    // Collect dispatch promises to run in parallel batches
    const DISPATCH_BATCH_SIZE = 10;
    const dispatchQueue: {
      apptId: string;
      trigger: string;
      fn: () => Promise<Awaited<ReturnType<typeof dispatchNotification>>>;
      patient: { id: string; name: string; phone: string };
      clinicId: string;
    }[] = [];

    for (const appt of appointments) {
      // SAFETY ASSERTION: Skip appointments without clinic_id to prevent
      // cross-tenant operations. This should never happen with correct RLS
      // but acts as defense-in-depth.
      if (!appt.clinic_id) {
        logger.warn("Skipping appointment without clinic_id", {
          context: "cron/reminders",
          appointmentId: appt.id,
        });
        continue;
      }

      try {
        assertClinicId(appt.clinic_id as string, "cron/reminders:appointment");
      } catch {
        logger.warn("Invalid clinic_id on appointment — skipped", {
          context: "cron/reminders",
          appointmentId: appt.id,
          clinicId: appt.clinic_id as string,
        });
        continue;
      }

      // Parse appointment datetime, falling back to slot_start when
      // appointment_date or start_time are NULL.
      let apptDatetime: Date;
      const slotStart = appt.slot_start as string | null;

      if (appt.appointment_date && appt.start_time) {
        // Normalize time to include seconds — "HH:MM" → "HH:MM:00" — so that
        // the ISO-8601-like string is unambiguous across runtimes (V8 vs others).
        const normalizedTime =
          String(appt.start_time).length === 5 ? `${appt.start_time}:00` : appt.start_time;
        apptDatetime = new Date(`${appt.appointment_date}T${normalizedTime}`);
      } else if (slotStart) {
        apptDatetime = new Date(slotStart);
      } else {
        // Neither field is available — skip this appointment
        continue;
      }

      if (isNaN(apptDatetime.getTime())) continue;

      // Determine which reminder to send
      const hoursUntil = (apptDatetime.getTime() - now.getTime()) / (1000 * 60 * 60);

      let trigger: "reminder_24h" | "reminder_1h" | null = null;

      if (hoursUntil > 0.5 && hoursUntil <= 1.5) {
        trigger = "reminder_1h";
      } else if (hoursUntil > 22 && hoursUntil <= 25) {
        trigger = "reminder_24h";
      }

      if (!trigger) continue;

      // Discard appointments beyond 25 hours (twoHoursFromNow is used
      // as the lower bound for 2h reminders above; twentyFourHoursFromNow
      // caps the query window).
      if (apptDatetime.getTime() > twentyFourHoursFromNow.getTime()) continue;

      // Type-safe access to joined data
      const patientRaw = appt.patients;
      const patient = Array.isArray(patientRaw) ? patientRaw[0] : patientRaw;
      const doctorRaw = appt.doctors;
      const doctor = Array.isArray(doctorRaw) ? doctorRaw[0] : doctorRaw;
      const serviceRaw = appt.services;
      const service = Array.isArray(serviceRaw) ? serviceRaw[0] : serviceRaw;

      if (!patient) continue;

      // Derive display date/time from the resolved datetime
      const displayDate = appt.appointment_date ?? getLocalDateStr(apptDatetime);
      const displayTime =
        appt.start_time ?? apptDatetime.toISOString().split("T")[1]?.slice(0, 5) ?? "";

      // Idempotency: skip if this reminder was already sent (checked
      // via the batch query above instead of one query per appointment).
      if (alreadySent.has(`${appt.id}:${trigger}`)) {
        continue;
      }

      const clinicRaw = appt.clinics;
      const clinic = Array.isArray(clinicRaw) ? clinicRaw[0] : clinicRaw;
      const clinicName = clinic?.name ?? "Clinic";

      const templateVars = {
        patient_name: patient.name,
        doctor_name: doctor?.name ?? "Doctor",
        clinic_name: clinicName,
        date: displayDate,
        time: displayTime,
        service_name: service?.name ?? "Appointment",
        clinic_address: "",
      };

      dispatchQueue.push({
        apptId: appt.id,
        trigger,
        fn: async () => {
          // Send interactive WhatsApp message with CONFIRM/CANCEL quick replies
          if (patient.phone) {
            const tpl = defaultNotificationTemplates.find(
              (t) => t.trigger === trigger && t.enabled && t.channels.includes("whatsapp"),
            );
            const body = tpl
              ? substituteVariables(tpl.whatsappBody, templateVars)
              : `Reminder: Your appointment is ${trigger === "reminder_24h" ? "tomorrow" : "in 1 hour"} at ${displayTime}. ${clinicName}`;

            await sendInteractiveMessage({
              to: patient.phone,
              body,
              buttons: [
                { id: "CONFIRM", title: "Confirm" },
                { id: "CANCEL", title: "Cancel" },
              ],
              footer: clinicName,
            });
          }

          // Also dispatch in-app + SMS notifications
          return dispatchNotification(trigger, templateVars, patient.id, ["sms", "in_app"]);
        },
        patient,
        clinicId: (appt.clinic_id as string) ?? "",
      });
    }

    // Execute dispatches in parallel batches to reduce total latency
    for (let i = 0; i < dispatchQueue.length; i += DISPATCH_BATCH_SIZE) {
      const batch = dispatchQueue.slice(i, i + DISPATCH_BATCH_SIZE);
      const settled = await Promise.allSettled(batch.map((d) => d.fn()));

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const outcome = settled[j];
        const success = outcome.status === "fulfilled" && outcome.value.some((r) => r.success);

        results.push({ appointmentId: item.apptId, type: item.trigger, success });

        if (success) {
          pendingLogInserts.push({
            appointment_id: item.apptId,
            trigger: item.trigger,
            channel: "reminder",
            status: "sent",
            clinic_id: item.clinicId,
            recipient_name: item.patient.name,
            recipient_phone: item.patient.phone,
          });
        }
      }
    }

    // Batch-insert all notification log entries in a single DB call.
    // API-008: Use upsert with ignoreDuplicates so the partial unique
    // index (uq_notification_log_dedup) silently skips already-sent rows.
    if (pendingLogInserts.length > 0) {
      await supabase.from("notification_log").upsert(pendingLogInserts, {
        onConflict: "appointment_id,trigger,channel",
        ignoreDuplicates: true,
      });
    }

    // A77-F1: Persist the last processed appointment's slot_start to KV
    // so the next 30-minute invocation can resume from here instead of
    // restarting from the beginning. This makes fan-out O(batch) per run.
    try {
      if (appointments.length > 0) {
        const lastAppt = appointments[appointments.length - 1] as AppointmentRow;
        const lastSlotStart = lastAppt.slot_start as string | null;
        // Only persist if we hit the limit (indicating there's more work to do).
        // If we drained the window, clear the cursor so the next run starts fresh.
        const kv = await getWorkerBinding<KVNamespace>("RATE_LIMIT_KV");
        if (kv) {
          if (appointments.length >= MAX_APPOINTMENTS_PER_RUN && lastSlotStart) {
            await kv.put(CRON_CURSOR_KEY, lastSlotStart, { expirationTtl: 3600 });
          } else {
            await kv.delete(CRON_CURSOR_KEY);
          }
        }
      }
    } catch (err) {
      logger.warn("cron/reminders: failed to persist KV cursor", {
        context: "cron/reminders",
        error: err,
      });
      // Non-fatal — next run will just restart from beginning
    }

    return apiSuccess({
      message: `Processed ${appointments.length} appointments`,
      sent: results.filter((r) => r.success).length,
      results,
    });
  } catch (err) {
    logger.warn("Failed to run reminders cron", { context: "cron/reminders", error: err });
    return apiInternalError("Failed to process reminders");
  }
}

export const GET = withSentryCron("reminders-every-30m", "*/30 * * * *", handler);
