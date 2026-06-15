import { NextResponse, type NextRequest } from "next/server";
import { applyRequestScopedResponseHeaders } from "@/lib/request-context-response-headers";
import { getPublicStatusSnapshot } from "@/lib/system-status";

// `runtime = "edge"` removed: incompatible with `experimental.useCache`
// (Next.js 16). It was also incorrect: this route transitively imports
// `@/lib/r2`, which uses Node's `crypto` module (createHash/createHmac),
// not available in the Edge runtime. @opennextjs/cloudflare deploys every
// route to Workers regardless of this declaration.
export const dynamic = "force-dynamic";

export async function GET(request?: NextRequest) {
  const snapshot = await getPublicStatusSnapshot();
  const response = NextResponse.json(snapshot, {
    status: snapshot.status === "down" ? 503 : 200,
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=30",
      "Content-Type": "application/json; charset=utf-8",
    },
  });

  return request ? applyRequestScopedResponseHeaders(request, response) : response;
}
