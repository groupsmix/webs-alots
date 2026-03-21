import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { dispatchNotification } from "@/lib/notifications";

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

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

    // Fetch upcoming appointments that need reminders
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(`
        id,
        clinic_id,
        patient_id,
        doctor_id,
        appointment_date,
        start_time,
        status,
        patients:patient_id (id, name, phone),
        doctors:doctor_id (id, name),
        services:service_id (name)
      `)
      .in("appointment_date", [todayStr, tomorrowStr])
      .in("status", ["confirmed", "pending"])
      .order("appointment_date")
      .order("start_time");

    if (error) {
      console.error("[Cron/Reminders] Query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({ message: "No upcoming appointments", sent: 0 });
    }

    const results: { appointmentId: string; type: string; success: boolean }[] = [];

    for (const appt of appointments) {
      // Parse appointment datetime
      const apptDatetime = new Date(`${appt.appointment_date}T${appt.start_time}`);

      // Determine which reminder to send
      const hoursUntil = (apptDatetime.getTime() - now.getTime()) / (1000 * 60 * 60);

      let trigger: "reminder_24h" | "reminder_2h" | null = null;

      if (hoursUntil > 1.5 && hoursUntil <= 2.5) {
        trigger = "reminder_2h";
      } else if (hoursUntil > 22 && hoursUntil <= 25) {
        trigger = "reminder_24h";
      }

      if (!trigger) continue;

      // Type-safe access to joined data
      const patient = appt.patients as unknown as { id: string; name: string; phone: string } | null;
      const doctor = appt.doctors as unknown as { id: string; name: string } | null;
      const service = appt.services as unknown as { name: string } | null;

      if (!patient) continue;

      const dispatchResults = await dispatchNotification(
        trigger,
        {
          patientName: patient.name,
          doctorName: doctor?.name ?? "Doctor",
          clinicName: "",
          date: appt.appointment_date,
          time: appt.start_time,
          serviceName: service?.name ?? "Appointment",
        },
        patient.id,
        ["whatsapp", "sms", "in_app"],
      );

      const success = dispatchResults.some((r) => r.success);
      results.push({ appointmentId: appt.id, type: trigger, success });
    }

    return NextResponse.json({
      message: `Processed ${appointments.length} appointments`,
      sent: results.filter((r) => r.success).length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Cron/Reminders] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
