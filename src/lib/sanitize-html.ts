/**
 * Lightweight server-safe HTML sanitization.
 *
 * Strips dangerous tags (script, iframe, object, embed, etc.) and
 * event-handler attributes (onclick, onerror, etc.) from HTML content
 * before rendering via dangerouslySetInnerHTML.
 *
 * Defence-in-depth: even when content comes from trusted static sources,
 * sanitization prevents stored XSS if the content pipeline is ever
 * compromised or extended to accept user/admin input.
 *
 * ⚠️  WARNING — NOT SAFE FOR ARBITRARY USER INPUT  ⚠️
 *
 * This function uses regex-based stripping which is inherently unreliable
 * for untrusted HTML. Known bypass vectors include:
 *   - Nested/malformed tags (e.g., `<scr<script>ipt>`).
 *   - Event handlers with tab/newline between attribute name and `=`.
 *   - Exotic elements: `<svg onload=...>`, `<math>`, `<details/open/ontoggle>`.
 *
 * Current usage is acceptable because the input comes from **static blog
 * content** (trusted source, not user-editable). If this function is ever
 * used for user-generated content (admin-editable blogs, rich text fields,
 * comments, etc.), it MUST be replaced with a DOM-based sanitizer such as
 * DOMPurify (client-side) or isomorphic-dompurify (server-side).
 */

/**
 * Strip dangerous HTML tags and attributes from a string of HTML.
 *
 * @see Module-level warning — this is defense-in-depth for trusted content only.
 */
export function sanitizeHtml(dirty: string): string {
  return (
    dirty
      // Remove <script>...</script> blocks (including multiline)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      // Remove self-closing <script /> tags
      .replace(/<script\b[^>]*\/>/gi, "")
      // Remove <iframe>, <object>, <embed>, <applet>, <form>, <base> tags
      .replace(/<\/?(iframe|object|embed|applet|form|base|meta|link)\b[^>]*>/gi, "")
      // Remove event handler attributes (onclick, onerror, onload, etc.)
      .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      // Remove javascript: protocol in href/src attributes
      .replace(/(href|src|action)\s*=\s*["']?\s*javascript\s*:/gi, "$1=\"\"")
      // Remove data: protocol in src attributes (except images)
      .replace(/src\s*=\s*["']?\s*data\s*:(?!image\/)/gi, "src=\"\"")
  );
}
