import type { NextConfig } from "next";

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
    // Content Security Policy
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Scripts: self + inline (Next.js hydration requires it)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: self + inline (Tailwind, shadcn)
      "style-src 'self' 'unsafe-inline'",
      // Images: self + R2 storage + Supabase storage + data URIs + blobs
      "img-src 'self' data: blob: *.supabase.co *.r2.cloudflarestorage.com *.r2.dev",
      // Fonts: self + common CDNs
      "font-src 'self' data:",
      // API connections: self + Supabase + WhatsApp + Cloudflare + Google
      "connect-src 'self' *.supabase.co wss://*.supabase.co graph.facebook.com api.twilio.com api.cloudflare.com *.googleapis.com",
      // Frames: Google Maps embeds only
      "frame-src 'self' www.google.com",
      // Form actions: self only
      "form-action 'self'",
      // Base URI: self only
      "base-uri 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
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
  },

  async redirects() {
    return [
      // Redirect www to non-www (canonical domain)
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.groupsmix.com" }],
        destination: "https://groupsmix.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
