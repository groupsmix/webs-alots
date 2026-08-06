import { getCloudflareApiConfig, getRootDomain } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Purge the Cloudflare edge cache for a clinic subdomain.
 *
 * This makes template, color, and hero-image changes visible on the public
 * site immediately instead of waiting for the 5-minute s-maxage TTL.
 *
 * Requires CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN. If either is missing,
 * the function logs and returns false without throwing.
 */
export async function purgeClinicPublicCache(subdomain: string): Promise<boolean> {
  const { apiToken: token, zoneId } = getCloudflareApiConfig();

  if (!zoneId || !token) {
    logger.warn(
      "Skipping Cloudflare cache purge: missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN",
      {
        context: "cloudflare-cache",
        subdomain,
      },
    );
    return false;
  }

  const rootDomain = getRootDomain();
  const host = `${subdomain}.${rootDomain}`;

  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ hosts: [host] }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn("Cloudflare cache purge failed", {
        context: "cloudflare-cache",
        subdomain,
        host,
        status: res.status,
        body,
      });
      return false;
    }

    logger.info("Cloudflare cache purged for clinic", {
      context: "cloudflare-cache",
      subdomain,
      host,
    });
    return true;
  } catch (err) {
    logger.warn("Cloudflare cache purge error", {
      context: "cloudflare-cache",
      subdomain,
      host,
      error: err,
    });
    return false;
  }
}
