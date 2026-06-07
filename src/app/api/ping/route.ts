// `runtime = "edge"` removed: incompatible with `experimental.useCache`
// (Next.js 16) and unnecessary on @opennextjs/cloudflare, which deploys
// every route to Workers regardless of this declaration.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      ts: Date.now(),
      region: process.env.CF_REGION ?? "unknown",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
