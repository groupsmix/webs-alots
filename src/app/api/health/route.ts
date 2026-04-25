import { apiSuccess } from "@/lib/api-response";
/**
 * GET /api/health
 *
 * Audit P2 #23: Fast path health check. Full deep checks have been moved to /api/health/internal.
 * This endpoint now caches the simple result for 30s to prevent abuse.
 */
export async function GET() {
  return apiSuccess(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    200,
    { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=59" },
  );
}
