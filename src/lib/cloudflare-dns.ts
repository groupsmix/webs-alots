/**
 * Cloudflare DNS Management — Auto-DNS & Subdomain Provisioning
 *
 * Provides functions for managing DNS records via the Cloudflare API.
 * Used during clinic onboarding to automatically create subdomain
 * CNAME records pointing to the main application.
 *
 * Configuration (env vars):
 *   - CLOUDFLARE_API_TOKEN  — API token with DNS:Edit permission
 *   - CLOUDFLARE_ZONE_ID    — Zone ID for the parent domain
 *   - CLOUDFLARE_ZONE_NAME  — Parent domain name (e.g. "oltigo.com")
 *
 * @example
 *   import { provisionSubdomain, removeSubdomain } from "@/lib/cloudflare-dns";
 *
 *   // During onboarding:
 *   await provisionSubdomain("dr-ahmed");
 *   // → Creates CNAME: dr-ahmed.oltigo.com → oltigo.com
 *
 *   // During clinic deletion:
 *   await removeSubdomain("dr-ahmed");
 */

import { logger } from "@/lib/logger";

// ── Types ────────────────────────────────────────────────────────────

export interface CloudflareConfig {
  apiToken: string;
  zoneId: string;
  zoneName: string;
}

export interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  created_on: string;
  modified_on: string;
}

export interface CloudflareResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface CloudflareApiResponse<T> {
  success: boolean;
  result: T;
  errors: { code: number; message: string }[];
  messages: { code: number; message: string }[];
}

// ── Configuration ────────────────────────────────────────────────────

function getConfig(): CloudflareConfig | null {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const zoneName = process.env.CLOUDFLARE_ZONE_NAME;

  if (!apiToken || !zoneId || !zoneName) {
    return null;
  }

  return { apiToken, zoneId, zoneName };
}

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

// ── API helpers ──────────────────────────────────────────────────────

async function cfFetch<T>(
  config: CloudflareConfig,
  path: string,
  options: RequestInit = {},
): Promise<CloudflareApiResponse<T>> {
  const url = `${CF_API_BASE}/zones/${config.zoneId}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });

  return (await response.json()) as CloudflareApiResponse<T>;
}

// ── Subdomain validation ─────────────────────────────────────────────

/**
 * Validate a subdomain slug.
 * Must be 2-63 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens.
 */
export function isValidSubdomain(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug);
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Create a CNAME record for a clinic subdomain.
 * Points `{slug}.{zoneName}` → `{zoneName}` (proxied through Cloudflare).
 */
export async function provisionSubdomain(
  slug: string,
): Promise<CloudflareResult<DnsRecord>> {
  const config = getConfig();
  if (!config) {
    return {
      success: false,
      error: "Cloudflare DNS not configured. Set CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, CLOUDFLARE_ZONE_NAME.",
    };
  }

  if (!isValidSubdomain(slug)) {
    return {
      success: false,
      error: `Invalid subdomain slug: "${slug}". Must be 2-63 lowercase alphanumeric characters or hyphens.`,
    };
  }

  const fqdn = `${slug}.${config.zoneName}`;

  // Check if the record already exists
  const existing = await getDnsRecord(slug);
  if (existing.success && existing.data) {
    logger.info("DNS record already exists, skipping creation", {
      context: "cloudflare-dns",
      subdomain: fqdn,
    });
    return { success: true, data: existing.data };
  }

  try {
    const result = await cfFetch<DnsRecord>(config, "/dns_records", {
      method: "POST",
      body: JSON.stringify({
        type: "CNAME",
        name: fqdn,
        content: config.zoneName,
        proxied: true,
        ttl: 1, // Auto TTL when proxied
        comment: `Auto-provisioned for clinic: ${slug}`,
      }),
    });

    if (!result.success) {
      const errMsg = result.errors.map((e) => e.message).join("; ");
      logger.error("Failed to create DNS record", {
        context: "cloudflare-dns",
        subdomain: fqdn,
        error: errMsg,
      });
      return { success: false, error: errMsg };
    }

    logger.info("DNS record created", {
      context: "cloudflare-dns",
      subdomain: fqdn,
      recordId: result.result.id,
    });

    return { success: true, data: result.result };
  } catch (err) {
    logger.error("Cloudflare API request failed", {
      context: "cloudflare-dns",
      subdomain: fqdn,
      error: err,
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Look up an existing DNS record for a subdomain.
 */
export async function getDnsRecord(
  slug: string,
): Promise<CloudflareResult<DnsRecord | null>> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "Cloudflare DNS not configured" };
  }

  const fqdn = `${slug}.${config.zoneName}`;

  try {
    const result = await cfFetch<DnsRecord[]>(
      config,
      `/dns_records?type=CNAME&name=${encodeURIComponent(fqdn)}`,
    );

    if (!result.success) {
      const errMsg = result.errors.map((e) => e.message).join("; ");
      return { success: false, error: errMsg };
    }

    const record = result.result[0] ?? null;
    return { success: true, data: record };
  } catch (err) {
    logger.error("Failed to look up DNS record", {
      context: "cloudflare-dns",
      subdomain: fqdn,
      error: err,
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Update an existing DNS record (e.g. change target or proxy settings).
 */
export async function updateDnsRecord(
  slug: string,
  updates: { content?: string; proxied?: boolean },
): Promise<CloudflareResult<DnsRecord>> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "Cloudflare DNS not configured" };
  }

  // First, find the existing record
  const existing = await getDnsRecord(slug);
  if (!existing.success || !existing.data) {
    return {
      success: false,
      error: `DNS record not found for subdomain: ${slug}`,
    };
  }

  const recordId = existing.data.id;
  const fqdn = `${slug}.${config.zoneName}`;

  try {
    const result = await cfFetch<DnsRecord>(
      config,
      `/dns_records/${recordId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          content: updates.content ?? existing.data.content,
          proxied: updates.proxied ?? existing.data.proxied,
        }),
      },
    );

    if (!result.success) {
      const errMsg = result.errors.map((e) => e.message).join("; ");
      return { success: false, error: errMsg };
    }

    logger.info("DNS record updated", {
      context: "cloudflare-dns",
      subdomain: fqdn,
      recordId,
    });

    return { success: true, data: result.result };
  } catch (err) {
    logger.error("Failed to update DNS record", {
      context: "cloudflare-dns",
      subdomain: fqdn,
      error: err,
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Remove a clinic's subdomain DNS record.
 */
export async function removeSubdomain(
  slug: string,
): Promise<CloudflareResult<void>> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "Cloudflare DNS not configured" };
  }

  // Find the record
  const existing = await getDnsRecord(slug);
  if (!existing.success || !existing.data) {
    // Already gone — idempotent
    return { success: true };
  }

  const recordId = existing.data.id;
  const fqdn = `${slug}.${config.zoneName}`;

  try {
    const result = await cfFetch<{ id: string }>(
      config,
      `/dns_records/${recordId}`,
      { method: "DELETE" },
    );

    if (!result.success) {
      const errMsg = result.errors.map((e) => e.message).join("; ");
      return { success: false, error: errMsg };
    }

    logger.info("DNS record removed", {
      context: "cloudflare-dns",
      subdomain: fqdn,
    });

    return { success: true };
  } catch (err) {
    logger.error("Failed to remove DNS record", {
      context: "cloudflare-dns",
      subdomain: fqdn,
      error: err,
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * List all auto-provisioned subdomain records for the zone.
 */
export async function listSubdomains(): Promise<CloudflareResult<DnsRecord[]>> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "Cloudflare DNS not configured" };
  }

  try {
    const result = await cfFetch<DnsRecord[]>(
      config,
      `/dns_records?type=CNAME&per_page=100&comment.contains=Auto-provisioned`,
    );

    if (!result.success) {
      const errMsg = result.errors.map((e) => e.message).join("; ");
      return { success: false, error: errMsg };
    }

    return { success: true, data: result.result };
  } catch (err) {
    logger.error("Failed to list DNS records", {
      context: "cloudflare-dns",
      error: err,
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
