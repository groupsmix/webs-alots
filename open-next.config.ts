import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";

/**
 * OpenNext (Cloudflare) configuration.
 *
 * Audit R-8: `next.config.ts` enables `experimental.useCache`, but without an
 * `incrementalCache` override OpenNext uses a no-op cache — so `"use cache"`
 * segments and ISR produced nothing durable across Worker isolates (cache was
 * effectively dead). We wire the R2-backed incremental cache so cached entries
 * persist in object storage and are shared across all isolates, fronted by the
 * per-isolate regional cache to cut read latency.
 *
 * The R2 adapter reads the `NEXT_INC_CACHE_R2_BUCKET` binding and degrades
 * gracefully (IgnorableError → behaves as no-op) if that binding is absent, so
 * this change is safe to ship before the bucket is provisioned. Activate real
 * caching by adding the `NEXT_INC_CACHE_R2_BUCKET` R2 binding in wrangler.toml
 * (documented there) and creating the bucket.
 */
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, {
    mode: "long-lived",
  }),
});
