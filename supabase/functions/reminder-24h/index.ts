/**
 * Supabase Edge Function: reminder-24h
 *
 * Scheduled function (cron) that runs daily.
 * Finds all appointments happening in the next 24 hours
 * and sends WhatsApp reminders to patients.
 */

// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// serve(async () => {
//   try {
//     const supabase = createClient(
//       Deno.env.get("SUPABASE_URL")!,
//       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
//     );
//
//     const tomorrow = new Date();
//     tomorrow.setDate(tomorrow.getDate() + 1);
//     const dateStr = tomorrow.toISOString().split("T")[0];
//
//     // Fetch tomorrow's appointments
//     const { data: appointments } = await supabase
//       .from("appointments")
//       .select("*, patient:users!patient_id(*)")
//       .eq("appointment_date", dateStr)
//       .in("status", ["pending", "confirmed"]);
//
//     // TODO: Send WhatsApp reminder to each patient
//     // TODO: Log notification records
//
//     return new Response(
//       JSON.stringify({
//         status: "reminders_sent",
//         count: appointments?.length ?? 0,
//       }),
//       { headers: { "Content-Type": "application/json" } },
//     );
//   } catch (error) {
//     return new Response(JSON.stringify({ error: error.message }), {
//       status: 500,
//     });
//   }
// });

export {};
