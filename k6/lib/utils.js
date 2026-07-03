/**
 * Shared k6 utility helpers.
 *
 * Centralises functions that are needed by more than one k6 script so that
 * bug-fixes and diagnostic improvements only need to be made in one place.
 */

/**
 * Parse a JSON response body with a diagnostic log on failure.
 *
 * Returns the parsed object on success, or null on failure so callers can
 * distinguish a parse error from a deliberate null value.
 *
 * Emits a warning when the response Content-Type is not `application/json`
 * so that malformed bodies are not silently masked as check=false.
 *
 * @param {import("k6/http").Response} r     the k6 HTTP response
 * @param {string}                     label a short identifier for log lines
 * @returns {object|null}
 */
export function parseJsonBody(r, label) {
  const ct = r.headers["Content-Type"] || "?";
  if (!ct.includes("application/json")) {
    console.warn(
      `[${label}] unexpected Content-Type '${ct}' (status=${r.status}) -- expected application/json`,
    );
  }
  try {
    return JSON.parse(r.body);
  } catch (e) {
    console.warn(
      `[${label}] JSON.parse failed (status=${r.status} content-type=${ct}): ${e.message}`,
    );
    return null;
  }
}
