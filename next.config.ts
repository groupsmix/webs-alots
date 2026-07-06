import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
// P3: protected route prefixes are DERIVED from the canonical capability layer
// so they can never drift from middleware / capabilities.ts. Relative import
// (not the `@/` alias) because next.config.ts is loaded outside the bundler's
// path-alias resolution. capabilities.ts has zero runtime deps, so it is safe
// to import here.
import { PROTECTED_ROUTE_PREFIXES_WITH_WILDCARDS } from "./src/lib/config/capabilities";

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// P3: DERIVED from `src/lib/config/capabilities.ts` (core role slugs +
// specialist capability slugs + documented extra protected slugs, each with
// its `:path*` wildcard variant). Do NOT hand-edit this list — change the
// capability layer instead. The `capabilities.test.ts` unit test asserts this
// stays fully in sync with the canonical source (no drift).
const PROTECTED_ROUTE_PREFIXES = PROTECTED_ROUTE_PREFIXES_WITH_WILDCARDS;

function getSupabaseImageHostname(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return "supabase-url-not-configured.invalid";

  try {
    return new URL(supabaseUrl).hostname;
  } catch {
    return "supabase-url-not-configured.invalid";
  }
}

// Security headers (X-Frame-Options, HSTS, X-Content-Type-Options, CSP, etc.)
// are applied exclusively in middleware.ts to avoid duplication and ensure
// consistency. See @/lib/middleware/security-headers for the implementation.

const nextConfig: NextConfig = {
  // Audit 2026-06-09 Task 2 (P0) — follow-up to #1016.
  // The build step in deploy.yml sets NEXT_PUBLIC_DATA_MASKING=partial, but
  // SWC's automatic process.env.NEXT_PUBLIC_* inlining did not reach
  // src/lib/mask.ts in the Cloudflare Workers build: the deployed chunk
  // contained `t.default.env.NEXT_PUBLIC_DATA_MASKING || "unset"` (a runtime
  // read against the Workers process polyfill) instead of the literal
  // "partial". In the browser that polyfill carries no NEXT_PUBLIC_DATA_MASKING,
  // so MASKING_BUILD_LEVEL evaluated to "unset" and getMaskLevel() returned
  // "none" — exactly the audit failure mode. The post-deploy smoke test then
  // also reported "none" (its regex picked up the nearest "none" literal,
  // which lives inside mask.ts's own comparisons).
  //
  // The `env` config field forces a static, AST-level replacement of
  // process.env.NEXT_PUBLIC_DATA_MASKING with the build-time value across
  // BOTH client and server bundles, regardless of how SWC happens to treat
  // the source file. Keep "partial" as the fallback so local builds without
  // the env var still ship a safe default.
  env: {
    NEXT_PUBLIC_DATA_MASKING: process.env.NEXT_PUBLIC_DATA_MASKING || "partial",
    // Ops dashboard "Last Deployment": inline a build timestamp so the metric
    // is populated even when CI does not set NEXT_PUBLIC_DEPLOY_TIME. CI may
    // still override it (e.g. with the deploy time or release SHA).
    NEXT_PUBLIC_DEPLOY_TIME: process.env.NEXT_PUBLIC_DEPLOY_TIME || new Date().toISOString(),
  },

  // E2E suite (login-flow / registration-flow / pricing / mobile-flows specs)
  // asserts `<Link>` hrefs in their canonical form (e.g. href="/login/").
  // Removing this flag drops the trailing slash from rendered hrefs and breaks
  // those assertions. Several middleware paths (CSRF exempt list, sitemap, the
  // CSP-via-headers rewrite map) also assume canonical-with-slash URLs.
  // Keep enabled until those paths and the E2E selectors are migrated.
  trailingSlash: true,

  // MEDIUM-9: Suppress X-Powered-By header (information disclosure).
  poweredByHeader: false,

  // CI runs `tsc --noEmit` (ci.yml) so the redundant type-check inside
  // `next build` is unnecessary. On the Cloudflare Workers Builds runner
  // (≈2 GB heap) it OOMs during this phase — skipping it fixes the build.
  typescript: {
    ignoreBuildErrors: true,
  },

  // PERF-01: Enable the stable `use cache` directive (Next.js 16).
  // Note: do NOT switch to `cacheComponents: true` until every route that
  // currently sets `export const dynamic = "force-dynamic"` (or
  // `runtime = "edge"`) is migrated. Cache Components rejects those route
  // segment configs at compile time, which broke the Cloudflare build in PR
  // #980. Keep using `experimental.useCache` until that migration lands.
  experimental: {
    useCache: true,
  },

  async headers() {
    return [
      {
        // CDN-01: Cache static assets (images, fonts) for 1 year.
        // These are content-hashed by Next.js, so immutable is safe.
        source: "/:path*.(ico|png|jpg|jpeg|svg|webp|avif|woff|woff2|ttf|eot|css)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // CDN-02: Next.js hashed JS/CSS bundles under _next/static are
        // safe to cache indefinitely. Cloudflare edge caches these via
        // s-maxage and serves them without hitting the Worker.
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, s-maxage=31536000, immutable",
          },
        ],
      },
      {
        // Default: prevent caching of API responses (authentication, patient
        // data, mutations, etc.).  Individual routes that serve truly public
        // data can override this with their own Cache-Control header.
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store",
          },
        ],
      },
      ...PROTECTED_ROUTE_PREFIXES.map((source) => ({
        source,
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate",
          },
        ],
      })),
      // [023]: Explicit CDN cache headers for public marketing pages.
      // s-maxage allows Cloudflare to cache for 5 minutes; stale-while-
      // revalidate serves the stale version for up to 24 hours while
      // revalidating in the background, improving TTFB for SEO crawlers.
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source:
          "/(services|about|testimonials|reviews|terms|privacy|accessibility|how-to-book|compare|location|doctor-services|doctor-profile|blog|annuaire)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },

  images: {
    // Allow external image domains for next/image (R2 and Supabase storage)
    // F-23: Restrict to Supabase storage and the project's custom R2 domain.
    // Removed **.r2.dev and **.r2.cloudflarestorage.com wildcards to prevent
    // abuse of the image optimizer with arbitrary R2 URLs.
    remotePatterns: [
      {
        protocol: "https",
        // Audit P2 #17: Pin to project instead of allowing **.supabase.co.
        // F-05: No wildcard fallback — if NEXT_PUBLIC_SUPABASE_URL is missing,
        // restrict to a non-matching placeholder so the build succeeds but
        // no external Supabase images are optimized. The env validation in
        // lib/env.ts will catch the missing URL at runtime.
        hostname: getSupabaseImageHostname(),
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "uploads.oltigo.com",
      },
    ],
    // S-39: Explicitly disable SVG processing to prevent XSS via embedded scripts.
    dangerouslyAllowSVG: false,
    // Optimize image delivery with modern formats
    formats: ["image/avif", "image/webp"],
    // Standardized device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Icon/thumbnail sizes
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  async redirects() {
    // WWW → non-www redirect is handled in middleware.ts so it works
    // on Cloudflare Workers (next.config redirects are not supported
    // by OpenNext on Workers). This block is kept for any future
    // non-host-based redirects.
    return [];
  },
};

export default withSentryConfig(withAnalyzer(nextConfig), {
  // Suppress noisy source-map upload logs in CI.
  silent: true,

  // Upload source maps only when a Sentry auth token is available.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
