import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const PROTECTED_ROUTE_PREFIXES = [
  "/patient",
  "/patient/:path*",
  "/doctor",
  "/doctor/:path*",
  "/receptionist",
  "/receptionist/:path*",
  "/admin",
  "/admin/:path*",
  "/super-admin",
  "/super-admin/:path*",
  "/pharmacist",
  "/pharmacist/:path*",
  "/nutritionist",
  "/nutritionist/:path*",
  "/optician",
  "/optician/:path*",
  "/parapharmacy",
  "/parapharmacy/:path*",
  "/physiotherapist",
  "/physiotherapist/:path*",
  "/psychologist",
  "/psychologist/:path*",
  "/radiology",
  "/radiology/:path*",
  "/speech-therapist",
  "/speech-therapist/:path*",
  "/equipment",
  "/equipment/:path*",
  "/lab-panel",
  "/lab-panel/:path*",
] as const;

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
  // Audit 2026-06-09 Task 2 follow-up: force build-time inlining of the PHI
  // masking level. With the OpenNext build, the bare process.env reference in
  // src/lib/mask.ts compiles to a runtime process-shim lookup in client
  // chunks (always undefined in browsers, so masking degraded to "none" -
  // caught by the post-deploy smoke test, failing every deploy since
  // 2026-06-11). Declaring it in `env` guarantees static replacement in the
  // client bundle. Defaults to "partial" (fail-closed) when absent.
  env: {
    NEXT_PUBLIC_DATA_MASKING: process.env.NEXT_PUBLIC_DATA_MASKING ?? "partial",
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
      // API Versioning: Sunset headers removed per audit finding S0-03-04.
      // The /api/v1/* routes are rewrites to unversioned handlers (see
      // rewrites() below), NOT independent implementations. Advertising a
      // Sunset date on the unversioned paths is misleading because both
      // paths resolve to the same handler. Re-add Sunset headers only once
      // real v1 handlers are implemented and unversioned paths are scheduled
      // for removal.
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

  async rewrites() {
    // API Versioning: map /api/v1/<route> to the existing unversioned
    // handlers so routes are accessible under both /api/<route> and
    // /api/v1/<route>. Old unversioned paths remain functional (backward
    // compat) but receive a Sunset header (see headers() above).
    const versionedRoutes = [
      "booking",
      "upload",
      "checkin",
      "chat",
      "notifications",
      "webhooks",
      "payments",
      "consent",
      "files",
    ];
    return {
      beforeFiles: versionedRoutes.flatMap((route) => [
        {
          source: `/api/v1/${route}`,
          destination: `/api/${route}`,
        },
        {
          source: `/api/v1/${route}/:path*`,
          destination: `/api/${route}/:path*`,
        },
      ]),
    };
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
