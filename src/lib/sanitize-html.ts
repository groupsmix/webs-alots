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
 */

/**
 * Strip dangerous HTML tags and attributes from a string of HTML.
 */
export function sanitizeHtml(dirty: string): string {
  return (
    dirty
      // Remove <script>...</script> blocks (including multiline)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      // Remove self-closing <script /> tags
      .replace(/<script\b[^>]*\/>/gi, "")
      // Remove <iframe>, <object>, <embed>, <applet>, <form>, <base>, <svg> tags and their content
      // SVG can contain script elements and event handlers that bypass other filters
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
      .replace(/<\/?(iframe|object|embed|applet|form|base|meta|link|svg|math)\b[^>]*>/gi, "")
      // Remove <style> blocks to prevent CSS-based attacks (e.g. expression(), url(), behavior)
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<\/?style\b[^>]*>/gi, "")
      // Remove event handler attributes (onclick, onerror, onload, etc.)
      .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      // Remove javascript: protocol in href/src/action/formaction/xlink:href attributes
      .replace(/(href|src|action|formaction|xlink:href)\s*=\s*["']?\s*javascript\s*:/gi, "$1=\"\"")
      // Remove vbscript: protocol
      .replace(/(href|src|action)\s*=\s*["']?\s*vbscript\s*:/gi, "$1=\"\"")
      // Remove data: protocol in src attributes (except images)
      .replace(/src\s*=\s*["']?\s*data\s*:(?!image\/)/gi, "src=\"\"")
      // Remove style attributes containing expressions or url() to prevent CSS injection
      .replace(/style\s*=\s*["'][^"']*(?:expression|url\s*\(|behavior\s*:)[^"']*["']/gi, "")
  );
}
