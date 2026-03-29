import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const securityHeaders = [
  {
    // Prevent the page from being embedded in iframes (clickjacking protection)
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Prevent MIME-type sniffing
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Control referrer information sent with requests
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Restrict browser features the app can use
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(self)",
  },
  {
    // Enforce HTTPS
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Control DNS prefetching for performance
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  // Content Security Policy is set dynamically in middleware.ts
  // with a per-request nonce for script-src (instead of 'unsafe-inline').
];

const nextConfig: NextConfig = {
  // Enable static generation for better performance
  trailingSlash: true,

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Report CSP violations for monitoring (doesn't block, just reports)
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy-Report-Only",
            value: "default-src 'self'; report-uri https://oltigo.com/api/csp-report",
          },
        ],
      },
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
        // Cache JS/CSS for 1 hour (with hashing, these are immutable)
        source: "/:path*.(js|css)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
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

// Sentry wraps the Next.js config for source-map upload and error tunneling.
// The NEXT_PUBLIC_SENTRY_DSN env var activates it; without the DSN the wrapper
// is a transparent pass-through.
import { withSentryConfig } from "@sentry/nextjs";

export default withSentryConfig(withAnalyzer(nextConfig), {
  // Suppress noisy source-map upload logs in CI.
  silent: true,

  // Upload source maps only when a Sentry auth token is available.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
