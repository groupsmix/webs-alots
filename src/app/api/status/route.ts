import { NextResponse } from "next/server";
import { getPublicStatusSnapshot } from "@/lib/system-status";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getPublicStatusSnapshot();
  return NextResponse.json(snapshot, {
    status: snapshot.status === "down" ? 503 : 200,
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=30",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
