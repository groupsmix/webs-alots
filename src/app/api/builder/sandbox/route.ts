/**
 * /api/builder/sandbox — STUB ONLY.
 *
 * The real handler lives in `workers/ai/src/handlers/builder-sandbox.ts`
 * and is served by the separate Cloudflare Worker `webs-alots-ai`.
 * Cloudflare zone routing sends `oltigo.com/api/builder/sandbox/*` to that
 * Worker before the main `webs-alots` Worker ever sees the request.
 *
 * This stub exists so the route remains discoverable in the Next.js app
 * and so `next dev` still responds to the path during local development.
 *
 * Why split? The @e2b sandbox + @ai-sdk/anthropic + ai SDK added ~1.1 MiB
 * of compressed bundle that pushed the main Worker over Cloudflare's 10 MiB
 * Workers Paid limit. See `workers/ai/README.md` for full context.
 *
 * If this stub ever runs IN PRODUCTION it means the Cloudflare Worker
 * Routes for the AI Worker are missing or pointed at the wrong Worker.
 */

function notServedHere(): Response {
  return new Response(
    JSON.stringify({
      error: "Route moved",
      message:
        "/api/builder/sandbox is served by the webs-alots-ai Worker. " +
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
