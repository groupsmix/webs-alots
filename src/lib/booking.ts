import { APPOINTMENT_STATUS } from "@/lib/types/database";
import type { AppointmentStatus } from "@/lib/types/database";

/**
 * Non-cancellable appointment statuses.
 *
 * An appointment in any of these states cannot be cancelled. This is the
 * single source of truth consumed by both the API route handler
 * (`/api/booking/cancel`) and client-side UI checks.
 */
export const NON_CANCELLABLE_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.RESCHEDULED,
]);

/**
 * Check whether an appointment's status allows cancellation.
 *
 * This is a pure status check — it does NOT validate the cancellation
 * time window. The server-side route performs the full timezone-aware
 * window check in addition to calling this function.
 */
export function isCancellableStatus(status: string): boolean {
  return !NON_CANCELLABLE_STATUSES.has(status as AppointmentStatus);
}
