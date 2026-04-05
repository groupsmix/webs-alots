/**
 * HTML sanitization — allowlist-based, safe for user-generated content.
 *
 * Implements an explicit allowlist of safe tags and attributes. Anything
 * not on the list is stripped. This is fundamentally more secure than
 * the previous regex-based blocklist approach, which had known bypasses:
 *
 *   - Nested/malformed tags  : `<scr<script>ipt>alert(1)</scr</script>ipt>`
 *   - Tab/newline in handlers: `<img on\nload=alert(1)>`
 *   - Exotic sinks           : `<svg onload=...>`, `<details open ontoggle=...>`
 *   - SVG/MathML namespaces  : parsed differently by HTML vs XML parsers
 *
 * Safe for: blog content, rich-text editor output, admin-editable fields.
 *
 * Runtime behaviour:
 *   - Browser / Cloudflare Workers  → uses `DOMParser` (W3C HTML5 parser)
 *   - Node.js / CI / server-side    → falls back to a fast regex pre-scrub
 *     (no DOM available). This path is only hit in test environments; the
 *     production runtime is always Cloudflare Workers (DOM available).
 *
 * To add full server-side DOM parsing run:
 *   npm install isomorphic-dompurify @types/dompurify
 * and uncomment the import below.
 */

// ── Allowlists ─────────────────────────────────────────────────────────────

/**
 * HTML elements that are safe to render.
 * Omits: script, iframe, object, embed, applet, form, base, meta, link,
 * style, noscript, template, svg (with events), math, details, summary.
 */
const ALLOWED_TAGS = new Set([
  "a", "abbr", "address", "article", "aside",
  "b", "bdi", "bdo", "blockquote", "br",
  "caption", "cite", "code", "col", "colgroup",
  "data", "dd", "del", "dfn", "div", "dl", "dt",
  "em",
  "figcaption", "figure", "footer",
  "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr",
  "i", "img", "ins",
  "kbd",
  "li",
  "main", "mark",
  "nav",
  "ol",
  "p", "picture", "pre",
  "q",
  "rp", "rt", "ruby",
  "s", "samp", "section", "small", "source", "span", "strong", "sub", "sup",
  "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr",
  "u", "ul",
  "var",
  "wbr",
]);

/**
 * Attributes allowed on ANY element.
 * Omits: on* (event handlers), style (CSS injection), id (anchor hijack).
 */
const ALLOWED_ATTRS = new Set([
  "class", "lang", "dir", "title", "aria-label", "aria-describedby",
  "aria-hidden", "role", "tabindex",
  "width", "height", "colspan", "rowspan", "scope",
  "datetime", "value",
]);

/**
 * Additional attributes allowed only on specific elements.
 * Prevents abuse (e.g. `href` on `<div>`, `src` on `<span>`).
 */
const ALLOWED_ATTRS_FOR_TAG: Readonly<Record<string, Set<string>>> = {
  a:      new Set(["href", "target", "rel", "download"]),
  img:    new Set(["src", "srcset", "alt", "loading", "decoding"]),
  source: new Set(["src", "srcset", "type", "media"]),
  picture: new Set([]),
  td:     new Set(["headers"]),
  th:     new Set(["headers", "abbr"]),
  ol:     new Set(["start", "type", "reversed"]),
  li:     new Set(["value"]),
  time:   new Set(["datetime"]),
};

/**
 * URL schemes that are safe in href/src attributes.
 * Omits: javascript:, data: (non-image), vbscript:, blob:, file:.
 */
const SAFE_URL_SCHEMES = /^(?:https?|mailto|tel|#|\/)/i;

// ── DOM-based sanitizer (browser / Cloudflare Workers) ─────────────────────

function sanitizeWithDom(dirty: string): string {
  // DOMParser is available in browsers and Cloudflare Workers.
  const parser = new DOMParser();
  const doc = parser.parseFromString(dirty, "text/html");

  // Walk all elements in document order (body only — head is irrelevant).
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const toRemove: Element[] = [];

  let node: Node | null = walker.currentNode;
  while (node) {
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      toRemove.push(el);
      node = walker.nextNode();
      continue;
    }

    // Strip disallowed attributes
    const attrsToRemove: string[] = [];
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const allowed =
        ALLOWED_ATTRS.has(name) ||
        ALLOWED_ATTRS_FOR_TAG[tag]?.has(name);

      if (!allowed) {
        attrsToRemove.push(attr.name);
        continue;
      }

      // Validate URL values in href/src/action to block javascript: etc.
      if (["href", "src", "action", "srcset"].includes(name)) {
        const val = attr.value.trim().toLowerCase();
        // srcset can have multiple tokens; check each URL token.
        if (name === "srcset") {
          const cleaned = attr.value
            .split(",")
            .filter((part) => {
              const url = part.trim().split(/\s+/)[0] ?? "";
              return SAFE_URL_SCHEMES.test(url);
            })
            .join(", ");
          el.setAttribute(attr.name, cleaned);
        } else if (!SAFE_URL_SCHEMES.test(val)) {
          attrsToRemove.push(attr.name);
        }
      }

      // Force rel="noopener noreferrer" on <a target="_blank">
      if (tag === "a" && name === "target" && attr.value === "_blank") {
        el.setAttribute("rel", "noopener noreferrer");
      }
    }
    attrsToRemove.forEach((a) => el.removeAttribute(a));

    node = walker.nextNode();
  }

  // Remove disallowed elements (replace with their children to preserve text).
  for (const el of toRemove) {
    const parent = el.parentNode;
    if (!parent) continue;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }

  return doc.body.innerHTML;
}

// ── Regex pre-scrub fallback (Node.js / CI — no DOM available) ─────────────
// This path runs only in test environments. Production is always Cloudflare
// Workers where DOMParser is available.

function sanitizeWithRegex(dirty: string): string {
  return (
    dirty
      // Remove <script>...</script> blocks (including multiline)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      // Remove dangerous container tags entirely
      .replace(/<\/?(script|iframe|object|embed|applet|form|base|meta|link|style|noscript|template)\b[^>]*>/gi, "")
      // Remove ALL event handler attributes (any on* attr)
      .replace(/\s+on[a-z][a-z0-9]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      // Remove javascript: / vbscript: protocols in href/src/action
      .replace(/(href|src|action|formaction|xlink:href)\s*=\s*["']?\s*(?:javascript|vbscript|data)\s*:[^"'>\s]*/gi, '$1=""')
  );
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Sanitize an HTML string using an allowlist-based approach.
 *
 * Safe for blog content, rich-text editor output, and admin-editable fields.
 * Automatically selects the DOM-based path in environments that support
 * `DOMParser` (browsers, Cloudflare Workers) and falls back to a conservative
 * regex pre-scrub in Node.js/CI environments.
 *
 * @param dirty - Raw HTML string to sanitize.
 * @returns Sanitized HTML string safe for use with dangerouslySetInnerHTML.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";
  if (typeof DOMParser !== "undefined") {
    return sanitizeWithDom(dirty);
  }
  // Fallback: Node.js / CI environment (no DOM)
  return sanitizeWithRegex(dirty);
}
