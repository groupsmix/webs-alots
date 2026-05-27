/**
 * WC-003 / A74-01: Timeout-guarded fetch wrapper for outbound calls.
 *
 * All server-side calls to third-party APIs (Stripe, WhatsApp, OpenAI,
 * Resend, Cloudflare, etc.) should use `safeFetch` instead of bare
 * `fetch` to enforce a hard timeout. This prevents a stalled upstream
 * from holding a Cloudflare Worker isolate until its CPU budget is
 * exhausted.
 *
 * Default timeout: 8 000 ms (well under the 30 s Worker wall-clock
 * limit, leaving headroom for retries and cleanup).
 */

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Fetch with an automatic `AbortSignal.timeout`. If the caller already
 * supplies a `signal` in `init`, the two signals are composed so that
 * whichever fires first aborts the request.
 */
export async function safeFetch(
  input: string | URL | Request,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init ?? {};
  const timeoutSignal = AbortSignal.timeout(timeoutMs);

  // Compose with any existing signal the caller provided
  const existingSignal = rest.signal;
  if (existingSignal) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    timeoutSignal.addEventListener("abort", onAbort, { once: true });
    existingSignal.addEventListener("abort", onAbort, { once: true });
    rest.signal = controller.signal;
  } else {
    rest.signal = timeoutSignal;
  }

  return fetch(input, rest);
}
