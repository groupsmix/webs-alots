/**
 * Supabase Edge Function: reminder-24h
 *
 * Scheduled function (cron) that runs daily.
 * Finds all appointments happening in the next 24 hours
 * and sends WhatsApp reminders to patients.
 *
 * Invoke via Supabase cron or manual call:
 *   POST /functions/v1/reminder-24h
 *
 * Required env vars (set in Supabase Dashboard > Edge Functions):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   WHATSAPP_PROVIDER (meta | twilio)
 *   WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN (for Meta)
 *   TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM (for Twilio)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface AppointmentRow {
  id: string;
  appointment_date: string;
  start_time: string;
  status: string;
  patient: { name: string; phone: string | null } | null;
  doctor: { name: string; phone: string | null } | null;
  clinic: { name: string; owner_phone: string | null } | null;
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

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    // Fetch tomorrow's appointments
    const { data: appointments } = await supabase
      .from("appointments")
      .select(
        "id, appointment_date, start_time, status, patient:users!patient_id(name, phone), doctor:users!doctor_id(name, phone), clinic:clinics(name, owner_phone)",
      )
      .eq("appointment_date", dateStr)
      .in("status", ["pending", "confirmed"]);

    const results: { appointmentId: string; sent: boolean }[] = [];

    for (const row of (appointments ?? []) as unknown as AppointmentRow[]) {
      if (!row.patient?.phone) {
        results.push({ appointmentId: row.id, sent: false });
        continue;
      }

      const body = `Reminder: You have an appointment with ${row.doctor?.name ?? "your doctor"} tomorrow at ${row.start_time}. ${row.clinic?.name ?? ""} — Please arrive 10 minutes early. Reply CONFIRM to confirm or CANCEL to cancel.`;
      const sent = await sendWhatsApp(row.patient.phone, body);
      results.push({ appointmentId: row.id, sent });

      // Log the notification
      await supabase.from("notification_log").insert({
        trigger: "reminder_24h",
        channel: "whatsapp",
        recipient_phone: row.patient.phone,
        recipient_name: row.patient.name,
        body,
        status: sent ? "sent" : "failed",
      }).then(() => {/* ignore log errors */});
    }

    return new Response(
      JSON.stringify({
        status: "reminders_sent",
        count: results.length,
        results,
      }),
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
