// eslint-disable-next-line import/order
import withBundleAnalyzer from "@next/bundle-analyzer";
// eslint-disable-next-line import/order
import { withSentryConfig } from "@sentry/nextjs";
// eslint-disable-next-line import/order
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
        // Next.js uses content-hashed filenames for static chunks, so they
        // are effectively immutable. Use a long max-age + immutable to avoid
        // unnecessary revalidation on repeat visits (PERF-08).
        source: "/_next/static/:path*",
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
    ];
  },

  images: {
    // Allow external image domains for next/image (R2 and Supabase storage)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/**",
      },
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
    ],
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
