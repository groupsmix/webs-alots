/**
 * Shared streaming body reader for webhook handlers.
 *
 * Enforces a hard byte cap regardless of whether Content-Length is present
 * (chunked transfer encoding bypass). Returns the decoded UTF-8 string or
 * `null` when the body exceeds the limit.
 *
 * Extracted from `src/app/api/payments/webhook/route.ts` (AUD-011, TASK-011).
 */

/** Default cap: 1 MB — generous for any Stripe/WhatsApp payload. */
const DEFAULT_MAX_BYTES = 1 * 1024 * 1024;

export async function readWebhookBody(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* best effort */
      }
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(out);
}
