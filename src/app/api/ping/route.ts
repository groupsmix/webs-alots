export const runtime = "edge";
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