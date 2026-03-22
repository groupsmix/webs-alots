import { NextResponse } from "next/server";

export const runtime = "edge";

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and load balancer probes.
 * Returns basic service status and uptime information.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
