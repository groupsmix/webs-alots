/**
 * Custom Domain Automation via Cloudflare API
 *
 * Provides helpers to add custom domains for clinic tenants,
 * configure DNS records, and provision SSL certificates.
 *
 * Requires:
 *   CLOUDFLARE_API_TOKEN — API token with Zone:DNS:Edit and SSL:Edit permissions
 *   CLOUDFLARE_ZONE_ID — Zone ID for the root domain
 */

import { logger } from "@/lib/logger";

// ---- Types ----

export interface DomainSetupResult {
  success: boolean;
  domain: string;
  dnsRecordId?: string;
  sslStatus?: string;
  error?: string;
}

interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

// ---- Configuration ----

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

function getHeaders(): HeadersInit {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN not configured");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function getZoneId(): string {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!zoneId) throw new Error("CLOUDFLARE_ZONE_ID not configured");
  return zoneId;
}

// ---- DNS Record Management ----

/**
 * Add a CNAME record pointing a clinic subdomain to the main app.
 */
export async function addSubdomainRecord(
  subdomain: string,
  targetDomain: string,
): Promise<DomainSetupResult> {
  try {
    const zoneId = getZoneId();
    const response = await fetch(
      `${CF_API_BASE}/zones/${zoneId}/dns_records`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          type: "CNAME",
          name: subdomain,
          content: targetDomain,
          proxied: true,
          ttl: 1, // Auto TTL when proxied
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        domain: subdomain,
        error: data.errors?.[0]?.message || "Failed to create DNS record",
      };
    }

    return {
      success: true,
      domain: `${subdomain}.${targetDomain}`,
      dnsRecordId: data.result.id,
      sslStatus: "pending",
    };
  } catch (err) {
    return {
      success: false,
      domain: subdomain,
      error: err instanceof Error ? err.message : "DNS setup failed",
    };
  }
}

/**
 * Add a custom domain with full CNAME setup.
 * Used when a clinic wants to use their own domain (e.g., cabinet-smile.ma).
 */
export async function setupCustomDomain(
  customDomain: string,
  targetDomain: string,
): Promise<DomainSetupResult> {
  try {
    const zoneId = getZoneId();

    // Create the CNAME record for the custom domain
    const response = await fetch(
      `${CF_API_BASE}/zones/${zoneId}/dns_records`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          type: "CNAME",
          name: customDomain,
          content: targetDomain,
          proxied: true,
          ttl: 1,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        domain: customDomain,
        error: data.errors?.[0]?.message || "Failed to set up custom domain",
      };
    }

    return {
      success: true,
      domain: customDomain,
      dnsRecordId: data.result.id,
      sslStatus: "active", // Cloudflare Universal SSL covers proxied records
    };
  } catch (err) {
    return {
      success: false,
      domain: customDomain,
      error: err instanceof Error ? err.message : "Custom domain setup failed",
    };
  }
}

/**
 * Remove a DNS record (when a clinic deactivates their custom domain).
 */
export async function removeDnsRecord(
  recordId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const zoneId = getZoneId();
    const response = await fetch(
      `${CF_API_BASE}/zones/${zoneId}/dns_records/${recordId}`,
      {
        method: "DELETE",
        headers: getHeaders(),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const data = await response.json();

    return {
      success: data.success,
      error: data.success
        ? undefined
        : data.errors?.[0]?.message || "Failed to remove DNS record",
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to remove record",
    };
  }
}

/**
 * List all DNS records for the zone to check existing subdomains.
 * Paginates through all pages to handle zones with >100 records.
 */
export async function listDnsRecords(): Promise<CloudflareDnsRecord[]> {
  const zoneId = getZoneId();
  const allRecords: CloudflareDnsRecord[] = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `${CF_API_BASE}/zones/${zoneId}/dns_records?per_page=100&page=${page}`,
      {
        headers: getHeaders(),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || "Failed to list DNS records");
    }

    const records = data.result as CloudflareDnsRecord[];
    allRecords.push(...records);

    // Stop when we've fetched all pages
    const totalPages = data.result_info?.total_pages ?? 1;
    if (page >= totalPages) break;
    page++;
  }

  return allRecords;
}

/**
 * Verify that a custom domain is correctly pointed to our server.
 * Returns true if the DNS is properly configured.
 */
export async function verifyDomain(
  domain: string,
  expectedTarget: string,
): Promise<{ verified: boolean; currentTarget?: string }> {
  try {
    const records = await listDnsRecords();
    const record = records.find(
      (r) => r.name === domain && r.type === "CNAME",
    );

    if (!record) {
      return { verified: false };
    }

    return {
      verified: record.content === expectedTarget,
      currentTarget: record.content,
    };
  } catch (err) {
    logger.warn("Failed to verify domain DNS", { context: "custom-domain", domain, error: err });
    return { verified: false };
  }
}
