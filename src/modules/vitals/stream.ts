/**
 * SSE Live Vitals Streaming — real-time patient data updates.
 *
 * Adapted from healthcare CRM patterns for real-time patient monitoring.
 * Uses Server-Sent Events (SSE) for one-way streaming from server to client,
 * which is ideal for vitals dashboards where the server pushes updates.
 *
 * Architecture:
 *   - Supabase Realtime subscription listens for INSERT on patient_vitals
 *   - Each SSE connection is scoped to a single patient + clinic (tenant isolation)
 *   - Heartbeat pings every 30s keep connections alive through proxies
 *   - Auto-cleanup on client disconnect
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/** SSE event types sent to the client. */
export type VitalsEventType = "vitals_update" | "heartbeat" | "error" | "connected";

/** Shape of a vitals update event payload. */
export interface VitalsUpdatePayload {
  id: string;
  patient_id: string;
  systolic?: number | null;
  diastolic?: number | null;
  heart_rate?: number | null;
  temperature?: number | null;
  weight?: number | null;
  oxygen_saturation?: number | null;
  recorded_at: string;
  recorded_by?: string | null;
}

/** Format a Server-Sent Event message. */
function formatSSE(event: VitalsEventType, data: unknown): string {
  const json = JSON.stringify(data);
  return `event: ${event}\ndata: ${json}\n\n`;
}

/** Heartbeat interval in milliseconds. */
const HEARTBEAT_INTERVAL_MS = 30_000;

/** Maximum connection duration (10 minutes). */
const MAX_CONNECTION_MS = 600_000;

/**
 * Create a ReadableStream that emits SSE events for patient vitals.
 *
 * The stream subscribes to Supabase Realtime for INSERT events on
 * the patient_vitals table, filtered by clinic_id and patient_id.
 */
export function createVitalsStream(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let maxTimer: ReturnType<typeof setTimeout> | null = null;
      let channel: ReturnType<typeof supabase.channel> | null = null;

      const cleanup = () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (maxTimer) clearTimeout(maxTimer);
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
      };

      try {
        controller.enqueue(
          encoder.encode(
            formatSSE("connected", {
              message: "Connexion établie — flux de signes vitaux actif",
              patient_id: patientId,
              timestamp: new Date().toISOString(),
            }),
          ),
        );

        const channelName = `vitals:${clinicId}:${patientId}`;
        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "patient_vitals",
              filter: `patient_id=eq.${patientId}`,
            },
            (payload) => {
              const row = payload.new as Record<string, unknown>;

              if (row.clinic_id !== clinicId) return;

              try {
                controller.enqueue(
                  encoder.encode(
                    formatSSE("vitals_update", {
                      id: row.id,
                      patient_id: row.patient_id,
                      systolic: row.systolic ?? null,
                      diastolic: row.diastolic ?? null,
                      heart_rate: row.heart_rate ?? null,
                      temperature: row.temperature ?? null,
                      weight: row.weight ?? null,
                      oxygen_saturation: row.oxygen_saturation ?? null,
                      recorded_at: row.recorded_at,
                      recorded_by: row.recorded_by ?? null,
                    }),
                  ),
                );
              } catch {
                cleanup();
              }
            },
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR") {
              logger.error("Vitals SSE channel error", {
                context: "vitals-stream",
                clinicId,
                patientId,
              });
              try {
                controller.enqueue(
                  encoder.encode(formatSSE("error", { message: "Erreur de connexion au flux" })),
                );
              } catch {
                // Stream already closed
              }
              cleanup();
            }
          });

        heartbeatTimer = setInterval(() => {
          try {
            controller.enqueue(
              encoder.encode(formatSSE("heartbeat", { timestamp: new Date().toISOString() })),
            );
          } catch {
            cleanup();
          }
        }, HEARTBEAT_INTERVAL_MS);

        maxTimer = setTimeout(() => {
          try {
            controller.enqueue(
              encoder.encode(
                formatSSE("error", {
                  message: "Durée maximale de connexion atteinte. Veuillez reconnecter.",
                  code: "MAX_DURATION",
                }),
              ),
            );
            controller.close();
          } catch {
            // Stream already closed
          }
          cleanup();
        }, MAX_CONNECTION_MS);
      } catch (err) {
        logger.error("Vitals stream setup failed", { context: "vitals-stream", error: err });
        cleanup();
      }
    },
  });
}
