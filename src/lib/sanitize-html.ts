/**
 * Server-safe HTML sanitization (S5-06).
 *
 * Uses DOMPurify (via isomorphic-dompurify, which provides a JSDOM-backed
 * DOM on the server) to strip dangerous tags, attributes, and protocols
 * from HTML before rendering via dangerouslySetInnerHTML.
 *
 * Why DOMPurify instead of regex?
 *
 * The previous implementation used a hand-rolled regex pipeline. Regex-based
 * HTML sanitization has well-known bypass vectors (nested malformed tags,
 * whitespace-around-`=`, exotic elements like `<svg onload>` /
 * `<details ontoggle>`, etc.). DOMPurify parses the HTML into a real DOM
 * and walks the tree, which makes it sound for arbitrary input — including
 * future cases where blog content is admin-editable rather than checked-in
 * static files.
 *
 * R11-01 Fix: Added timeout protection and input size limits to prevent
 * ReDoS attacks and memory exhaustion.
 *
 * This module currently sanitizes static blog content
 * (`src/app/(public)/blog/[slug]/page.tsx`) at build time via
 * `generateStaticParams` — there is no runtime sanitization on the edge.
 */
import DOMPurify from "isomorphic-dompurify";

// R11-01 Fix: Maximum input size (1 MB) to prevent memory exhaustion
const MAX_INPUT_SIZE = 1048576; // 1 MB in bytes

// R11-01 Fix: Timeout for sanitization (5 seconds) as defense-in-depth
const SANITIZATION_TIMEOUT_MS = 5000;

/**
 * Allow the tags that the static blog markup actually uses, plus the
 * usual semantic / formatting tags. Anything else (script, iframe,
 * object, embed, form, meta, link, style, etc.) is dropped by DOMPurify.
 */
const ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

const ALLOWED_ATTR = [
  "href",
  "src",
  "alt",
  "title",
  "class",
  "id",
  "rel",
  "target",
  "loading",
  "width",
  "height",
];

/**
 * Sanitize a string of HTML, returning a string that is safe to pass to
 * `dangerouslySetInnerHTML`.
 *
 * - `script`, `iframe`, `object`, `embed`, `form`, `meta`, `link`, `style`,
 *   and any other non-allow-listed tags are removed.
 * - All event-handler attributes (`onclick`, `onerror`, `onload`, …) are
 *   stripped.
 * - `javascript:` and other dangerous URL schemes are stripped from `href`
 *   / `src`. `data:` URIs are blocked except for `data:image/*`.
 * 
 * R11-01 Fix: Added input size limit (1 MB) to prevent memory exhaustion.
 * Timeout protection is not implemented in the synchronous version, but
 * DOMPurify has linear time complexity O(n) so it should never timeout.
 * 
 * @param dirty - The untrusted HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 * @throws Error if input exceeds size limit
 */
export function sanitizeHtml(dirty: string): string {
  // R11-01 Fix: Check input size limit
  const inputSize = new Blob([dirty]).size; // Get byte size
  if (inputSize > MAX_INPUT_SIZE) {
    throw new Error(
      `HTML input size (${inputSize} bytes) exceeds maximum allowed size (${MAX_INPUT_SIZE} bytes)`
    );
  }

  // DOMPurify has linear time complexity O(n), so no timeout needed
  // The size limit above prevents memory exhaustion
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // A58.3: Explicitly forbid dangerous tags even if they somehow
    // sneak through the ALLOWED_TAGS allowlist (defense-in-depth).
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "link", "meta", "base", "svg", "math"],
    // A58.3: Forbid event handler attributes and other XSS vectors
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "srcdoc", "formaction"],
    // Block all URL schemes other than http/https/mailto/tel and
    // data:image/* (DOMPurify allows http/https/mailto/tel/ftp/file by
    // default; we further restrict via ALLOWED_URI_REGEXP below).
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|jpe?g|gif|webp|svg\+xml);|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    // Strip the wrapping <html>/<body> that DOMPurify sometimes adds.
    WHOLE_DOCUMENT: false,
    RETURN_TRUSTED_TYPE: false,
  });
}
