/**
 * Before & After section — only renders when the clinic has uploaded
 * before/after images via the dashboard. Returns null (renders nothing)
 * when no data is available, avoiding placeholder content in production.
 *
 * This section is intentionally a no-op until the before/after feature
 * is implemented in the dashboard (image upload + database schema).
 */
export function BeforeAfterSection() {
  // No data source available yet — return null to avoid placeholder content.
  return null;
}
