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
 * The `NEXT_INC_CACHE_R2_BUCKET` binding is declared in wrangler.toml and the
 * `ENABLE_R2_INCREMENTAL_CACHE=1` env is set in `package.json` (build:cf/deploy)
 * and `.github/workflows/deploy.yml` so the durable cache is used by default.
 * The override is still gated on `ENABLE_R2_INCREMENTAL_CACHE` as an explicit
 * opt-out (set `ENABLE_R2_INCREMENTAL_CACHE=0` to fall back to the no-op cache).
 *
 * The bucket is auto-created on first deploy if it does not exist; if that
 * fails, create it manually with `wrangler r2 bucket create webs-alots-next-cache`.
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
