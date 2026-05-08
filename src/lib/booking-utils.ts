import type { AppointmentStatus } from "@/lib/types/database";

/**
 * Statuses that prevent an appointment from being cancelled.
 * An appointment in any of these states has already reached a terminal
 * or irreversible state.
 */
export const NON_CANCELLABLE_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  "cancelled",
  "completed",
  "rescheduled",
]);

/**
 * Returns `true` when the appointment's current status allows cancellation.
 *
 * This is a pure status check — the server-side cancellation endpoint also
 * enforces a timezone-aware cancellation window.  Use this function for
 * quick client-side gating before hitting the API.
 */
export function isCancellableStatus(status: AppointmentStatus): boolean {
  return !NON_CANCELLABLE_STATUSES.has(status);
}
