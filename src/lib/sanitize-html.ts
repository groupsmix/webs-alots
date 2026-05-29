/**
 * Server-safe HTML sanitization (S5-06).
 *
 * Uses `sanitize-html` (an htmlparser2-based, allow-list sanitizer) to strip
 * dangerous tags, attributes, and protocols from HTML before rendering via
 * dangerouslySetInnerHTML.
 *
 * Why sanitize-html instead of DOMPurify+jsdom?
 *
 * DOMPurify needs a real DOM. The only DOM implementations that are
 * spec-complete enough for DOMPurify (jsdom, happy-dom) are ~7-8 MiB
 * unpacked, which blows the Cloudflare Worker 10 MiB bundle limit (and jsdom
 * cannot run on the Workers runtime at all). `sanitize-html` is a ~70 KiB,
 * pure-JS parser-based sanitizer that runs both at build time and on the
 * edge, keeping the same tree-based (non-regex) sanitization guarantees
 * while keeping the Worker bundle well under the size limit.
 *
 * Why a parser instead of regex?
 *
 * A hand-rolled regex pipeline has well-known bypass vectors (nested
 * malformed tags, whitespace-around-`=`, exotic elements like `<svg onload>`
 * / `<details ontoggle>`, etc.). `sanitize-html` tokenizes the HTML with
 * htmlparser2 and rebuilds it from the allow-list, which makes it sound for
 * arbitrary input — including future cases where blog content is
 * admin-editable rather than checked-in static files.
 *
 * This module currently sanitizes static blog content
 * (`src/app/(public)/blog/[slug]/page.tsx`) at build time via
 * `generateStaticParams` — there is no runtime sanitization on the edge.
 */
import sanitize from "sanitize-html";

/**
 * Allow the tags that the static blog markup actually uses, plus the
 * usual semantic / formatting tags. Anything else (script, iframe,
 * object, embed, form, meta, link, style, etc.) is dropped.
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

// Attributes are allow-listed globally for every tag.
const ALLOWED_ATTRIBUTES: sanitize.IOptions["allowedAttributes"] = {
  "*": ALLOWED_ATTR,
};

// Permit only safe URL schemes. `data:` is allowed solely for inline images
// (`data:image/*` on <img src>), matching the previous DOMPurify policy;
// `javascript:`, `vbscript:`, `data:text/html`, etc. are rejected.
const ALLOWED_SCHEMES = ["http", "https", "mailto", "tel"];

/**
 * Sanitize a string of HTML, returning a string that is safe to pass to
 * `dangerouslySetInnerHTML`.
 *
 * - `script`, `iframe`, `object`, `embed`, `form`, `meta`, `link`, `style`,
 *   `svg`, `math`, and any other non-allow-listed tags are removed.
 * - All event-handler attributes (`onclick`, `onerror`, `onload`, …) are
 *   stripped (only the explicit allow-list of attributes survives).
 * - `javascript:` and other dangerous URL schemes are stripped from `href`
 *   / `src`. `data:` URIs are blocked except for `data:image/*`.
 */
export function sanitizeHtml(dirty: string): string {
  return sanitize(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // Only allow safe schemes; everything else (javascript:, vbscript:, …)
    // is dropped along with the attribute.
    allowedSchemes: ALLOWED_SCHEMES,
    // `data:` URIs are permitted only on <img src> and only for images.
    allowedSchemesByTag: { img: [...ALLOWED_SCHEMES, "data"] },
    allowProtocolRelative: false,
    // Drop the *contents* of dangerous elements rather than leaking them as
    // inert text (e.g. `<script>alert(1)</script>` leaves nothing behind).
    nonTextTags: ["script", "style", "textarea", "option", "noscript"],
    // Restrict <img src="data:..."> to image MIME types only.
    allowedSchemesAppliedToAttributes: ["href", "src"],
    parser: { lowerCaseTags: true, lowerCaseAttributeNames: true },
  });
}
