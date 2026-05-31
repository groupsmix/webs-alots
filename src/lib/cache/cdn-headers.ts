/**
 * CDN cache header utilities for R2-served assets.
 *
 * Cloudflare automatically caches responses based on Cache-Control headers.
 * This module provides standard header configurations for different asset types.
 *
 * Usage in API routes serving R2 files:
 *   const headers = getCDNHeaders("medical-image");
 *   return new Response(body, { headers });
 */

type AssetCategory = "medical-image" | "document" | "clinic-logo" | "phi-file" | "static-asset";

const CACHE_PROFILES: Record<AssetCategory, string> = {
  /** Medical images (X-rays, scans): cached 1 hour, must revalidate. */
  "medical-image": "public, max-age=3600, must-revalidate",
  /** Documents (PDFs, reports): cached 24 hours, stale while revalidate. */
  document: "public, max-age=86400, stale-while-revalidate=3600",
  /** Clinic logos/branding: cached 7 days. */
  "clinic-logo": "public, max-age=604800, stale-while-revalidate=86400",
  /** PHI files: never cache publicly, only private browser cache. */
  "phi-file": "private, no-store, no-cache",
  /** Static assets (JS, CSS, fonts): immutable, cached 1 year. */
  "static-asset": "public, max-age=31536000, immutable",
};

/**
 * Get appropriate Cache-Control headers for an asset category.
 */
export function getCDNHeaders(category: AssetCategory): Headers {
  const headers = new Headers();
  headers.set("Cache-Control", CACHE_PROFILES[category]);

  // Add Vary header for content-type negotiation.
  headers.set("Vary", "Accept-Encoding");

  // Security headers for all responses.
  headers.set("X-Content-Type-Options", "nosniff");

  return headers;
}

/**
 * Determine asset category from MIME type.
 */
export function categorizeAsset(mimeType: string): AssetCategory {
  if (mimeType.startsWith("image/")) return "medical-image";
  if (mimeType === "application/pdf") return "document";
  if (mimeType.startsWith("text/") || mimeType.includes("javascript") || mimeType.includes("css")) {
    return "static-asset";
  }
  // Default to PHI-safe (no cache) for unknown types.
  return "phi-file";
}
