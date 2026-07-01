import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";

/**
 * OpenNext (Cloudflare) configuration.
 *
 * Audit R-8: `next.config.ts` enables `experimental.useCache`, but without an
 * `incrementalCache` override OpenNext uses a no-op cache — so `"use cache"`
 * segments and ISR produce nothing durable across Worker isolates. The R2-backed
 * incremental cache (fronted by the per-isolate regional cache) fixes that by
 * persisting entries in object storage shared across all isolates.
 *
 * DEPLOY-TIME GATE — why this is behind a flag
 * --------------------------------------------
 * `r2IncrementalCache` reads the `NEXT_INC_CACHE_R2_BUCKET` binding. Its "degrades
 * gracefully when the binding is absent" behaviour only applies at REQUEST time
 * (a missing binding raises an IgnorableError that the runtime treats as a no-op).
 * At DEPLOY time it is NOT graceful: `opennextjs-cloudflare deploy` runs a
 * `populate-cache` step that hard-throws
 *
 *     Error: No R2 binding "NEXT_INC_CACHE_R2_BUCKET" found!
 *
 * whenever the override is configured but the binding / bucket has not been
 * provisioned. wrangler.toml intentionally ships that binding commented out
 * (the dedicated bucket must be created first — it must NOT reuse the PHI
 * UPLOADS_BUCKET), so wiring the override unconditionally made every
 * `wrangler deploy` fail. That is the deploy failure this gate resolves.
 *
 * Default (flag unset): OpenNext's built-in no-op cache — matches the
 * "safe to ship before the bucket is provisioned" intent documented in
 * wrangler.toml, and lets `wrangler deploy` succeed.
 *
 * To ACTIVATE durable caching (all three must be done together, in one deploy):
 *   1. wrangler r2 bucket create webs-alots-next-cache   (+ -staging variant)
 *   2. Uncomment the NEXT_INC_CACHE_R2_BUCKET r2_buckets blocks in wrangler.toml
 *      (top level AND [env.production] / [env.staging]).
 *   3. Set ENABLE_R2_INCREMENTAL_CACHE=1 in the deploy workflow env (it must be
 *      present for BOTH the build and deploy steps so the bundle and the
 *      populate-cache step agree).
 */
const r2IncrementalCacheEnabled = process.env.ENABLE_R2_INCREMENTAL_CACHE === "1";

export default defineCloudflareConfig(
  r2IncrementalCacheEnabled
    ? {
        incrementalCache: withRegionalCache(r2IncrementalCache, {
          mode: "long-lived",
        }),
      }
    : {},
);
