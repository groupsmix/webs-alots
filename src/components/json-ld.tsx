import { safeJsonLdStringify } from "@/lib/json-ld";

/**
 * Renders a JSON-LD structured-data <script>.
 *
 * The CSP `nonce` is emitted during SSR but React clears the `nonce` attribute
 * from the DOM after hydration (to avoid leaking it), so a naive `nonce={nonce}`
 * script triggers a "server rendered HTML didn't match the client" hydration
 * warning. `suppressHydrationWarning` is the intended escape hatch for this
 * exact case — the attribute difference is expected and harmless.
 */
export function JsonLd({ data, nonce }: { data: unknown; nonce?: string }) {
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      suppressHydrationWarning
      // SAFETY: safeJsonLdStringify escapes "<" to prevent </script> injection.
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(data) }}
    />
  );
}
