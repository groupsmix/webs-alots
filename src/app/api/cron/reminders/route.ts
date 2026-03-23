import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { dispatchNotification } from "@/lib/notifications";
import { APPOINTMENT_STATUS } from "@/lib/types/database";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/reminders
 *
 * Automated appointment reminder endpoint.
 * Called by the Cloudflare Worker scheduled handler (see worker-cron-handler.ts)
 * every 30 minutes via the cron triggers defined in wrangler.toml.
 *
 * Sends two types of reminders:
 * - reminder_24h: For appointments happening in the next 24 hours
 * - reminder_2h: For appointments happening in the next 2 hours
 *
 * Protected by CRON_SECRET via Authorization: Bearer header.
 */
export async function GET(request: NextRequest) {
  // DRY: Use shared cron secret verification helper
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const supabase = await createClient();
    const now = new Date();

    // Calculate time windows
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // FIX (MED-05): Use ISO timestamp range filtering instead of date-string
    // filtering. Date-string filtering (e.g. appointment_date.in.(today,tomorrow))
    // misses appointments near timezone boundaries because the server's UTC date
    // may differ from the clinic's local date.
    const nowISO = now.toISOString();
    const twentyFourHoursISO = twentyFourHoursFromNow.toISOString();

    // Fetch upcoming appointments that need reminders.
    // Select both appointment_date/start_time and slot_start/slot_end
    // since older records may only have slot_start/slot_end populated.
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(`
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
      `)
      .in("status", [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.PENDING])
      .or(
        `slot_start.gte.${nowISO},slot_start.lte.${twentyFourHoursISO}`,
      )
      .limit(500);

    if (error) {
        logger.warn("Operation failed", { context: "route", error });
        return NextResponse.json({ error: "Failed to query appointments" }, { status: 500 });
    }

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({ message: "No upcoming appointments", sent: 0 });
    }

    // --- Batch idempotency check (avoids N+1 queries) ---
    // Fetch ALL already-sent reminder logs for the candidate appointments
    // in a single query, then use a Set for O(1) lookups in the loop.
    const appointmentIds = appointments.map((a) => a.id);
    const { data: sentLogs } = await supabase
      .from("notification_log")
      .select("appointment_id, trigger")
      .in("appointment_id", appointmentIds)
      .eq("channel", "reminder")
      .eq("status", "sent");

    const alreadySent = new Set(
      (sentLogs ?? []).map((l) => `${l.appointment_id}:${l.trigger}`),
    );

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
      // Parse appointment datetime, falling back to slot_start when
      // appointment_date or start_time are NULL.
      let apptDatetime: Date;
      const slotStart = appt.slot_start as string | null;

      if (appt.appointment_date && appt.start_time) {
        apptDatetime = new Date(`${appt.appointment_date}T${appt.start_time}`);
      } else if (slotStart) {
        apptDatetime = new Date(slotStart);
      } else {
        // Neither field is available — skip this appointment
        continue;
      }

      if (isNaN(apptDatetime.getTime())) continue;

      // Determine which reminder to send
      const hoursUntil = (apptDatetime.getTime() - now.getTime()) / (1000 * 60 * 60);

      let trigger: "reminder_24h" | "reminder_2h" | null = null;

      if (hoursUntil > 1.5 && hoursUntil <= 2.5) {
        trigger = "reminder_2h";
      } else if (hoursUntil > 22 && hoursUntil <= 25) {
        trigger = "reminder_24h";
      }

      if (!trigger) continue;

      // Discard appointments beyond 25 hours (twoHoursFromNow is used
      // as the lower bound for 2h reminders above; twentyFourHoursFromNow
      // caps the query window).
      if (apptDatetime.getTime() > twentyFourHoursFromNow.getTime()) continue;
      if (apptDatetime.getTime() < twoHoursFromNow.getTime() && trigger === "reminder_2h") continue;

      // Type-safe access to joined data
      const patient = appt.patients as unknown as { id: string; name: string; phone: string } | null;
      const doctor = appt.doctors as unknown as { id: string; name: string } | null;
      const service = appt.services as unknown as { name: string } | null;

      if (!patient) continue;

      // Derive display date/time from the resolved datetime
      const displayDate = appt.appointment_date ?? apptDatetime.toISOString().split("T")[0];
      const displayTime = appt.start_time ?? apptDatetime.toISOString().split("T")[1]?.slice(0, 5) ?? "";

      // Idempotency: skip if this reminder was already sent (checked
      // via the batch query above instead of one query per appointment).
      if (alreadySent.has(`${appt.id}:${trigger}`)) {
        continue;
      }

      const clinic = appt.clinics as unknown as { name: string } | null;
      const clinicName = clinic?.name ?? "Clinic";

      dispatchQueue.push({
        apptId: appt.id,
        trigger,
        fn: () =>
          dispatchNotification(
            trigger,
            {
              patient_name: patient.name,
              doctor_name: doctor?.name ?? "Doctor",
              clinic_name: clinicName,
              date: displayDate,
              time: displayTime,
              service_name: service?.name ?? "Appointment",
            },
            patient.id,
            ["whatsapp", "sms", "in_app"],
          ),
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
        const success =
          outcome.status === "fulfilled" &&
          outcome.value.some((r) => r.success);

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

    // Batch-insert all notification log entries in a single DB call
    if (pendingLogInserts.length > 0) {
      await supabase.from("notification_log").insert(pendingLogInserts);
    }

    return NextResponse.json({
      message: `Processed ${appointments.length} appointments`,
      sent: results.filter((r) => r.success).length,
      results,
    });
  } catch (err) {
    logger.warn("Operation failed", { context: "route", error: err });
    return NextResponse.json({ error: "Failed to process reminders" }, { status: 500 });
  }
}
