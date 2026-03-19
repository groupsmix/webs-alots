/**
 * Supabase Edge Function: notify-booking
 *
 * Triggered when a new appointment is created.
 * Sends WhatsApp notifications to:
 *   - Patient (booking confirmation)
 *   - Doctor (new appointment alert)
 *   - Receptionist (new booking notification)
 */

// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// serve(async (req: Request) => {
//   try {
//     const { appointmentId } = await req.json();
//
//     const supabase = createClient(
//       Deno.env.get("SUPABASE_URL")!,
//       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
//     );
//
//     // Fetch appointment details
//     const { data: appointment } = await supabase
//       .from("appointments")
//       .select("*, patient:users!patient_id(*), doctor:users!doctor_id(*)")
//       .eq("id", appointmentId)
//       .single();
//
//     if (!appointment) {
//       return new Response(JSON.stringify({ error: "Appointment not found" }), {
//         status: 404,
//       });
//     }
//
//     // TODO: Send WhatsApp notification to patient
//     // TODO: Send WhatsApp notification to doctor
//     // TODO: Send dashboard notification to receptionist
//
//     return new Response(JSON.stringify({ status: "notifications_sent" }), {
//       headers: { "Content-Type": "application/json" },
//     });
//   } catch (error) {
//     return new Response(JSON.stringify({ error: error.message }), {
//       status: 500,
//     });
//   }
// });

export {};
