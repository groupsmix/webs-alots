/**
 * /api/copilotkit — STUB ONLY.
 *
 * The real handler lives in `workers/ai/src/handlers/copilotkit.ts` and
 * is served by the separate Cloudflare Worker `webs-alots-ai`. Cloudflare
 * zone routing sends `oltigo.com/api/copilotkit/*` to that Worker before
 * the main `webs-alots` Worker ever sees the request.
 *
 * This stub exists so the route remains discoverable in the Next.js app
 * (search results, file-tree, route table) and so `next dev` still
 * responds to the path during local development with a clear message
 * instead of a confusing 404.
 *
 * Why split? The CopilotKit runtime + Anthropic SDK + ai SDK added ~1.1 MiB
 * of compressed bundle that pushed the main Worker over Cloudflare's 10 MiB
 * Workers Paid limit. See `workers/ai/README.md` for full context.
 *
 * If this stub ever runs IN PRODUCTION (a 501 response from `oltigo.com`
 * instead of from `webs-alots-ai`) it means the Cloudflare Worker Routes
 * for the AI Worker are missing or pointed at the wrong Worker.
 */

function notServedHere(): Response {
  return new Response(
    JSON.stringify({
      error: "Route moved",
      message:
        "/api/copilotkit is served by the webs-alots-ai Worker. " +
        "In production this stub should never run — Cloudflare routes the URL " +
        "to webs-alots-ai. If you are seeing this in production, check the " +
        "Worker Routes config in workers/ai/wrangler.toml.",
    }),
    {
      status: 501,
      headers: {
        "Content-Type": "application/json",
        "X-Route-Owner": "webs-alots-ai",
      },
    },
  );
}

export async function POST() {
  return notServedHere();
}

export async function GET() {
  return notServedHere();
}
