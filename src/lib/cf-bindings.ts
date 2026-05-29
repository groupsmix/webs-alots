/**
 * Request-time resolver for Cloudflare Worker bindings (KV namespaces,
 * Durable Object namespaces, etc.).
 *
 * Under @opennextjs/cloudflare (v1.17+), Worker bindings are exposed on
 * `getCloudflareContext().env` and are **not** attached to `globalThis`.
 * Reading them off `globalThis` therefore always yields `undefined` in
 * production — which previously made the rate limiter treat its KV/DO backend
 * as permanently unavailable and (after the grace period) fail closed for
 * every request.
 *
 * This helper resolves a binding via the OpenNext context first, then falls
 * back to `globalThis` for local dev, unit tests, and non-OpenNext runtimes.
 *
 * It never throws: `getCloudflareContext()` raises when called outside an
 * initialised request context (build, module init, tests), and the dynamic
 * import may itself fail in non-Worker runtimes — both are swallowed so
 * callers can use this safely at request time.
 *
 * Must only be called at request time (inside a handler), never at module
 * init, since the OpenNext context is request-scoped.
 */
export async function getWorkerBinding<T>(name: string): Promise<T | undefined> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as unknown as Record<string, unknown>;
    const binding = env?.[name] as T | undefined;
    if (binding) return binding;
  } catch {
    // Context unavailable (build/module-init/tests/non-OpenNext) — fall back.
  }
  return (globalThis as unknown as Record<string, T | undefined>)[name];
}
