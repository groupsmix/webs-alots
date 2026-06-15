import { apiError, apiSuccess } from "@/lib/api-response";
import { safeFetch } from "@/lib/fetch-wrapper";
import { withAuth } from "@/lib/with-auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(
  async (_request, auth) => {
    if (auth.profile.role !== "super_admin") {
      return apiError("Forbidden", 403, "FORBIDDEN");
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken) {
      return apiError("Cloudflare credentials not configured", 503, "CF_NOT_CONFIGURED");
    }

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    const query = {
      query: `{
      viewer {
        accounts(filter: { accountTag: "${accountId}" }) {
          workersInvocationsAdaptive(
            limit: 10,
            filter: { datetime_geq: "${yesterday}T00:00:00Z", datetime_leq: "${today}T23:59:59Z" }
          ) {
            sum { requests errors subrequests cpuTimeP50 cpuTimeP99 }
            dimensions { scriptName }
          }
        }
      }
    }`,
    };

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
      return apiError("Failed to fetch Cloudflare metrics", 502, "CF_API_ERROR");
    }

    const data = await response.json();
    return apiSuccess({ workers: data, fetchedAt: new Date().toISOString() });
  },
  ["super_admin"],
);
