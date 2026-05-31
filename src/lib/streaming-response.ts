/**
 * A62-E1: HTTP Streaming Response Guards
 *
 * Problem:
 *   AI streaming endpoints (patient summary, prescription suggestions, etc.)
 *   use ReadableStream without guardrails. A slow/malicious upstream could:
 *   - Send data indefinitely (memory exhaustion on server or client)
 *   - Hang the connection (exhausting worker threads)
 *   - Send corrupt/partial data (downstream parsing errors)
 *
 * Solution:
 *   Wrap the generator in a timeout + byte-count decorator before creating
 *   the ReadableStream. Enforces hard limits on duration and output size.
 */

export interface StreamingConfig {
  /** Absolute timeout in milliseconds for the entire stream (default: 30s) */
  timeoutMs?: number;
  /** Maximum bytes to stream before truncating (default: 10MB) */
  maxBytes?: number;
  /** Chunk size to minimize buffering and memory pressure (default: 4KB) */
  chunkSizeBytes?: number;
}

const DEFAULTS: Required<StreamingConfig> = {
  timeoutMs: 30_000, // 30 seconds
  maxBytes: 10 * 1024 * 1024, // 10 MB
  chunkSizeBytes: 4 * 1024, // 4 KB
};

/**
 * Wrap an async generator in timeout + byte-count guards.
 * Returns a safe Response with streaming body or throws an error.
 *
 * @param generator The async iterable yielding string chunks
 * @param config Streaming limits (timeoutMs, maxBytes, chunkSizeBytes)
 * @returns Promise<Response> with 200 and streaming body, or error response
 */
export async function safeStreamingResponse(
  generator: AsyncIterable<string>,
  config?: StreamingConfig,
): Promise<Response> {
  const cfg = { ...DEFAULTS, ...config };

  let bytesEmitted = 0;
  let timedOut = false;

  // Set a hard timeout on the entire stream.
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
  }, cfg.timeoutMs);

  // Create the streaming body with guards applied
  const { readable, writable } = new TransformStream<string>();
  const writer = writable.getWriter();

  // Write chunks asynchronously, respecting limits
  (async () => {
    try {
      for await (const chunk of generator) {
        if (timedOut) {
          // Append a truncation notice instead of silently dropping
          await writer.write("[... stream timeout, truncated ...]\n");
          break;
        }

        // Check byte limit BEFORE writing
        if (bytesEmitted + chunk.length > cfg.maxBytes) {
          // Emit what we can and append a truncation notice
          const remaining = cfg.maxBytes - bytesEmitted;
          if (remaining > 0) {
            await writer.write(chunk.slice(0, remaining));
            bytesEmitted += remaining;
          }
          await writer.write("\n[... output exceeds maximum size, truncated ...]\n");
          break;
        }

        bytesEmitted += chunk.length;
        await writer.write(chunk);

        // Yield control periodically to avoid blocking
        if (bytesEmitted % (cfg.chunkSizeBytes * 10) === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    } catch (err) {
      // Write error to stream if possible; otherwise just close
      if (bytesEmitted + 100 < cfg.maxBytes) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await writer.write(`\n[Error: ${errMsg}]\n`);
      }
    } finally {
      clearTimeout(timeoutHandle);
      await writer.close();
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      // Signal to the client that this is a streaming response
      "Transfer-Encoding": "chunked",
    },
  });
}

/**
 * Example: How to use in an AI streaming route.
 *
 * ```ts
 * import { safeStreamingResponse } from "@/lib/streaming-response";
 *
 * async function* generateSummary(patientId: string) {
 *   // Yield chunks from your AI provider
 *   const stream = await openai.chat.completions.stream({...});
 *   for await (const event of stream) {
 *     yield event.choices[0]?.delta.content ?? "";
 *   }
 * }
 *
 * export const GET = async (req: NextRequest) => {
 *   return safeStreamingResponse(generateSummary(patientId), {
 *     timeoutMs: 45_000, // 45 seconds for patient summary
 *     maxBytes: 20 * 1024 * 1024, // 20 MB
 *   });
 * };
 * ```
 */
