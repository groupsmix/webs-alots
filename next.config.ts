import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// Security headers (X-Frame-Options, HSTS, X-Content-Type-Options, CSP, etc.)
// are applied exclusively in middleware.ts to avoid duplication and ensure
// consistency. See @/lib/middleware/security-headers for the implementation.

const nextConfig: NextConfig = {
  // Enable static generation for better performance
  trailingSlash: true,

  // MEDIUM-9: Suppress X-Powered-By header (information disclosure).
  poweredByHeader: false,

  // PERF-01: Enable the stable `use cache` directive (Next.js 16).
  experimental: {
    useCache: true,
  },

  async headers() {
    return [
      {
        // Cache static assets for 1 year
        source: "/:path*.(ico|png|jpg|jpeg|svg|webp|avif|woff|woff2|ttf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
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
      {
        // A36.8: Prevent shared caches (CDN, ISP proxies) from storing
        // authenticated dashboard pages. Without this, Next.js may emit a
        // default Cache-Control that allows intermediate caches to store
        // the rendered admin shell, potentially leaking PHI to the wrong
        // tenant or an unauthenticated user.
        source: "/dashboard/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate",
          },
        ],
      },
      {
        // A36.8: Same treatment for admin pages.
        source: "/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate",
          },
        ],
      },
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
      // API Versioning: Sunset header on unversioned routes that are now
      // also available under /api/v1/. Signals to API consumers that the
      // unversioned paths will be removed in a future release.
      ...[
        "booking",
        "upload",
        "checkin",
        "chat",
        "notifications",
        "webhooks",
        "payments",
        "consent",
        "files",
      ].flatMap((route) => [
        {
          source: `/api/${route}`,
          headers: [
            { key: "Sunset", value: "Sat, 31 Dec 2026 23:59:59 GMT" },
            { key: "Deprecation", value: "true" },
            { key: "Link", value: `</api/v1/${route}>; rel="successor-version"` },
          ],
        },
        {
          source: `/api/${route}/:path*`,
          headers: [
            { key: "Sunset", value: "Sat, 31 Dec 2026 23:59:59 GMT" },
            { key: "Deprecation", value: "true" },
            { key: "Link", value: `</api/v1/${route}>; rel="successor-version"` },
          ],
        },
      ]),
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
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL
          ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
          : "supabase-url-not-configured.invalid",
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
