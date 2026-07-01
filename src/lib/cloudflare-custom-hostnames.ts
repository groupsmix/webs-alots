/**
 * Cloudflare for SaaS — Custom Hostname Management
 *
 * Enables white-label support by allowing clinics to use their own domains.
 * Uses Cloudflare's Custom Hostnames API (SSL for SaaS) to provision
 * and manage custom domains with automatic SSL certificate issuance.
 *
 * Configuration (env vars):
 *   - CLOUDFLARE_ZONE_ID     — Zone ID for the parent domain
 *   - CLOUDFLARE_API_TOKEN   — API token with SSL:Edit + Custom Hostnames:Edit
 *   - CLOUDFLARE_ZONE_NAME   — Parent domain name (e.g. "oltigo.com")
 */

import { safeFetch } from "@/lib/fetch-wrapper";
import { logger } from "@/lib/logger";

interface CloudflareCustomHostnameResult {
  id: string;
  hostname: string;
  status: string;
  ssl: {
    status: string;
    method: string;
    type: string;
    validation_records?: Array<{
      txt_name: string;
      txt_value: string;
    }>;
  };
  verification_errors?: string[];
  ownership_verification?: {
    type: string;
    name: string;
    value: string;
  };
}

export interface CustomHostnameResponse {
  success: boolean;
  data?: CloudflareCustomHostnameResult;
  error?: string;
}

function getAuth(): { zoneId: string; headers: HeadersInit } | null {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!zoneId) return null;

  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (apiToken) {
    return {
      zoneId,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    };
  }

  return null;
}

export async function createCustomHostname(hostname: string): Promise<CustomHostnameResponse> {
  const auth = getAuth();
  if (!auth) {
    return { success: false, error: "Cloudflare credentials not configured" };
  }

  try {
    const response = await safeFetch(
      `https://api.cloudflare.com/client/v4/zones/${auth.zoneId}/custom_hostnames`,
      {
        method: "POST",
        headers: auth.headers,
        body: JSON.stringify({
          hostname,
          ssl: {
            method: "http",
            type: "dv",
            settings: {
              min_tls_version: "1.2",
            },
          },
        }),
      },
    );

    const json = await response.json();
    if (!json.success) {
      const errorMsg = json.errors?.[0]?.message ?? "Unknown Cloudflare error";
      logger.error("Cloudflare custom hostname creation failed", { hostname, error: errorMsg });
      return { success: false, error: errorMsg };
    }

    return { success: true, data: json.result };
  } catch (error) {
    logger.error("Cloudflare custom hostname API error", { hostname, error });
    return { success: false, error: "Failed to communicate with Cloudflare API" };
  }
}

export async function deleteCustomHostname(
  customHostnameId: string,
): Promise<{ success: boolean; error?: string }> {
  const auth = getAuth();
  if (!auth) {
    return { success: false, error: "Cloudflare credentials not configured" };
  }

  try {
    const response = await safeFetch(
      `https://api.cloudflare.com/client/v4/zones/${auth.zoneId}/custom_hostnames/${customHostnameId}`,
      {
        method: "DELETE",
        headers: auth.headers,
      },
    );

    const json = await response.json();
    if (!json.success) {
      const errorMsg = json.errors?.[0]?.message ?? "Unknown Cloudflare error";
      logger.error("Cloudflare custom hostname deletion failed", {
        customHostnameId,
        error: errorMsg,
      });
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (error) {
    logger.error("Cloudflare custom hostname delete API error", { customHostnameId, error });
    return { success: false, error: "Failed to communicate with Cloudflare API" };
  }
}

export async function getCustomHostnameStatus(
  customHostnameId: string,
): Promise<CustomHostnameResponse> {
  const auth = getAuth();
  if (!auth) {
    return { success: false, error: "Cloudflare credentials not configured" };
  }

  try {
    const response = await safeFetch(
      `https://api.cloudflare.com/client/v4/zones/${auth.zoneId}/custom_hostnames/${customHostnameId}`,
      {
        method: "GET",
        headers: auth.headers,
      },
    );

    const json = await response.json();
    if (!json.success) {
      const errorMsg = json.errors?.[0]?.message ?? "Unknown Cloudflare error";
      return { success: false, error: errorMsg };
    }

    return { success: true, data: json.result };
  } catch (error) {
    logger.error("Cloudflare custom hostname status API error", { customHostnameId, error });
    return { success: false, error: "Failed to communicate with Cloudflare API" };
  }
}
