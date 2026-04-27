/**
 * F-38: Stream-read body size enforcement.
 *
 * Unlike Content-Length header checks (which can be spoofed), this
 * utility actually consumes the request body stream and aborts if
 * the real payload exceeds the limit.
 */

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Read a request body with a hard byte-count limit.
 * Throws an error if the body exceeds `maxBytes`.
 */
export async function readBodyWithLimit(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        reader.cancel();
        throw new BodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const decoder = new TextDecoder();
  return chunks.map((c) => decoder.decode(c, { stream: true })).join("") +
    decoder.decode();
}

export class BodyTooLargeError extends Error {
  readonly status = 413;
  constructor(maxBytes: number) {
    super(`Request body exceeds maximum size of ${maxBytes} bytes`);
    this.name = "BodyTooLargeError";
  }
}
