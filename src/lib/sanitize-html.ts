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
 * **WARNING (SEC-04):** This function uses regex-based stripping which
 * is NOT suitable for untrusted / user-generated HTML.  HTML is not a
 * regular language — nested, malformed, or creative markup can bypass
 * these patterns (e.g. `<scr<script>ipt>`, tab characters in event
 * attributes, exotic elements like `<svg onload>`, `<math>`, etc.).
 *
 * For user-generated content, use a proper DOM-based sanitizer such as
 * DOMPurify (client) or isomorphic-dompurify (server).
 *
 * Current usage with **static blog content only** is acceptable as an
 * additional defence-in-depth layer.
 */

/**
 * Strip dangerous HTML tags and attributes from a string of HTML.
 *
 * @see Module-level JSDoc for important security caveats.
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
