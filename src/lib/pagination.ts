/**
 * Keyset (cursor) pagination helpers for the public REST API.
 *
 * Offset pagination has two well-known problems on healthcare workloads:
 *
 *   1. Performance — `OFFSET N` forces Postgres to read and discard N rows
 *      before returning a page, which is O(N) per request.
 *   2. Correctness — concurrent inserts/deletes shift items between pages,
 *      so clients can see duplicates or miss rows entirely as they paginate.
 *
 * Keyset pagination encodes the sort key of the last row as an opaque
 * cursor and uses a row-comparison predicate to fetch strictly "older"
 * rows on the next page.
 *
 * For appointments the natural sort key is the tuple
 * `(appointment_date, start_time, id)` — `id` is the tiebreaker so the
 * predicate is total even when two appointments share a date and time.
 */

export interface AppointmentCursor {
  /** ISO date string `YYYY-MM-DD` (matches `appointments.appointment_date`). */
  appointment_date: string;
  /** Time string `HH:MM[:SS]` (matches `appointments.start_time`). */
  start_time: string;
  /** Row primary key — tiebreaker for rows with identical date+time. */
  id: string;
}

/**
 * Encode a cursor as a URL-safe base64 string. Opaque to clients — they
 * should treat the value as a black box and only round-trip it back as
 * the `cursor` query parameter on the next request.
 */
export function encodeCursor(cursor: AppointmentCursor): string {
  const json = JSON.stringify(cursor);
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/**
 * Decode a cursor produced by `encodeCursor`. Returns `null` when the
 * value is malformed so the route can respond with 400 rather than
 * leaking parser errors to the client.
 */
export function decodeCursor(value: string): AppointmentCursor | null {
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).appointment_date === "string" &&
      typeof (parsed as Record<string, unknown>).start_time === "string" &&
      typeof (parsed as Record<string, unknown>).id === "string"
    ) {
      const c = parsed as AppointmentCursor;
      // Defensive validation — these values are interpolated into a
      // PostgREST `or()` filter, so reject anything that contains the
      // delimiters PostgREST uses to separate filters.
      if (/[,()]/.test(c.appointment_date) || /[,()]/.test(c.start_time) || /[,()]/.test(c.id)) {
        return null;
      }
      return c;
    }
    return null;
  } catch {
    return null;
  }
}
