/**
 * GET /api/system/r2-metrics
 *
 * Returns R2 bucket usage metrics via the Cloudflare Analytics Engine / GraphQL API.
 * Falls back to a "configured but no data" state if CF credentials are absent.
 * Requires super_admin role.
 */

import { apiError, apiSuccess } from "@/lib/api-response";
import { safeFetch } from "@/lib/fetch-wrapper";
import { withAuth } from "@/lib/with-auth";

export const dynamic = "force-dynamic";

interface R2UsageRow {
  bucketName: string;
  actionType: string;
  requests: number;
  bytes: number;
}

export const GET = withAuth(
  async (_request, auth) => {
    if (auth.profile.role !== "super_admin") {
      return apiError("Forbidden", 403, "FORBIDDEN");
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return apiSuccess({
        available: false,
        reason: "CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN not configured",
        fetchedAt: new Date().toISOString(),
      });
    }

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    const query = {
      query: `{
      viewer {
        accounts(filter: { accountTag: "${accountId}" }) {
          r2OperationsAdaptiveGroups(
            limit: 100,
            filter: {
              datetime_geq: "${yesterday}T00:00:00Z",
              datetime_leq: "${today}T23:59:59Z"
            }
          ) {
            sum { requests bytes }
            dimensions { bucketName actionType }
          }
        }
      }
    }`,
    };

    try {
      const response = await safeFetch("https://api.cloudflare.com/client/v4/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify(query),
        cache: "no-store",
      });

      if (!response.ok) {
        return apiSuccess({
          available: false,
          reason: `Cloudflare API error: ${response.status}`,
          fetchedAt: new Date().toISOString(),
        });
      }

      const data = (await response.json()) as {
        data?: {
          viewer?: {
            accounts?: Array<{
              r2OperationsAdaptiveGroups?: Array<{
                sum: { requests: number; bytes: number };
                dimensions: { bucketName: string; actionType: string };
              }>;
            }>;
          };
        };
      };

      const rawRows = data.data?.viewer?.accounts?.[0]?.r2OperationsAdaptiveGroups ?? [];

      const rows: R2UsageRow[] = rawRows.map((row) => ({
        bucketName: row.dimensions.bucketName,
        actionType: row.dimensions.actionType,
        requests: row.sum.requests,
        bytes: row.sum.bytes,
      }));

      // Aggregate totals per bucket
      const byBucket: Record<string, { totalRequests: number; totalBytes: number }> = {};
      for (const row of rows) {
        const b = row.bucketName;
        if (!byBucket[b]) byBucket[b] = { totalRequests: 0, totalBytes: 0 };
        byBucket[b].totalRequests += row.requests;
        byBucket[b].totalBytes += row.bytes;
      }

      return apiSuccess({
        available: true,
        period: { from: yesterday, to: today },
        rows,
        byBucket: Object.entries(byBucket).map(([bucketName, totals]) => ({
          bucketName,
          ...totals,
          totalMB: Math.round((totals.totalBytes / 1_048_576) * 100) / 100,
        })),
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      return apiSuccess({
        available: false,
        reason: err instanceof Error ? err.message : "Unknown error querying Cloudflare API",
        fetchedAt: new Date().toISOString(),
      });
    }
  },
  ["super_admin"],
);
