import { createRateLimiter } from "@/lib/rate-limit";

const DEFAULT_WEBHOOK_WINDOW_MS = 60_000;
const DEFAULT_WEBHOOK_MAX = 100;

const webhookSenderLimiter = createRateLimiter({
  windowMs: DEFAULT_WEBHOOK_WINDOW_MS,
  max: DEFAULT_WEBHOOK_MAX,
  failClosed: true,
});

function normalizeSenderId(senderId: string | null | undefined): string {
  if (!senderId) return "unknown";
  return senderId.trim().toLowerCase().slice(0, 64) || "unknown";
}

export async function checkWebhookSenderRateLimit(
  provider: string,
  senderId: string | null | undefined,
): Promise<boolean> {
  return webhookSenderLimiter.check(`webhook:${provider}:${normalizeSenderId(senderId)}`);
}
