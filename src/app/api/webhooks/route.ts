import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/webhooks
 *
 * Receives incoming webhooks from WhatsApp Business API.
 * Processes incoming messages and triggers appropriate actions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // TODO: Verify webhook signature
    // TODO: Process incoming WhatsApp messages
    // TODO: Route to appropriate handler (booking, query, etc.)

    console.log("Webhook received:", JSON.stringify(body));

    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/webhooks
 *
 * WhatsApp webhook verification endpoint.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
