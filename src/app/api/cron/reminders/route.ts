import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { dispatchNotification } from "@/lib/notifications";
import { APPOINTMENT_STATUS } from "@/lib/types/database";
import { timingSafeEqual } from "@/lib/crypto-utils";

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
  // Verify cron secret (Authorization: Bearer <CRON_SECRET>)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providedToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!timingSafeEqual(providedToken, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const now = new Date();

    // Calculate time windows
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const todayStr = now.toISOString().split("T")[0];
    const tomorrowStr = twentyFourHoursFromNow.toISOString().split("T")[0];

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
        services:service_id (name)
      `)
      .in("status", [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.PENDING])
      .or(
        `appointment_date.in.(${todayStr},${tomorrowStr}),and(appointment_date.is.null,slot_start.gte.${now.toISOString()},slot_start.lte.${twentyFourHoursFromNow.toISOString()})`,
      )
      .limit(500);

    if (error) {
        console.error("[Cron/Reminders] Query error:", error.message);
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

    const results: { appointmentId: string; type: string; success: boolean }[] = [];

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

      const dispatchResults = await dispatchNotification(
        trigger,
        {
          patient_name: patient.name,
          doctor_name: doctor?.name ?? "Doctor",
          clinic_name: "",
          date: displayDate,
          time: displayTime,
          service_name: service?.name ?? "Appointment",
        },
        patient.id,
        ["whatsapp", "sms", "in_app"],
      );

      const success = dispatchResults.some((r) => r.success);
      results.push({ appointmentId: appt.id, type: trigger, success });

      // Record the sent reminder in the notification_log table for idempotency.
      // Subsequent cron runs will find this entry and skip the reminder.
      if (success) {
        await supabase
          .from("notification_log")
          .insert({
            appointment_id: appt.id,
            trigger,
            channel: "reminder",
            status: "sent",
            clinic_id: appt.clinic_id,
            recipient_name: patient.name,
            recipient_phone: patient.phone,
          });
      }
    }

    return NextResponse.json({
      message: `Processed ${appointments.length} appointments`,
      sent: results.filter((r) => r.success).length,
      results,
    });
  } catch (err) {
    console.error("[Cron/Reminders] Error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ error: "Failed to process reminders" }, { status: 500 });
  }
}
