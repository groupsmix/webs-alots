/**
 * Escape HTML special characters to prevent XSS when interpolating
 * user-controlled data into HTML template literals.
 *
 * Handles `undefined` and `null` gracefully by returning an empty string.
 */
export function escapeHtml(str: string | undefined | null): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
