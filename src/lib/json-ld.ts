/**
 * Safe JSON-LD serializer for use with dangerouslySetInnerHTML.
 *
 * JSON.stringify alone is insufficient inside <script> tags because a string
 * value containing "</script>" would close the tag and allow script injection.
 * This utility escapes the forward-slash in "</script>" (and similar sequences)
 * so the output is safe to embed in an HTML <script type="application/ld+json"> block.
 */
export function safeJsonLdStringify(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
