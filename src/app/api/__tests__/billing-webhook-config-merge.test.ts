/**
 * Q-01 regression test — `src/app/api/billing/webhook/route.ts` must
 * deep-merge subscription keys into the existing `clinics.config` jsonb
 * column instead of replacing it. The previous implementation called
 * `update({ config: { subscription_* } })`, which clobbered every
 * per-clinic operational setting (`timezone`, `workingHours`, …) on
 * every Stripe event.
 *
 * The single assertion this test must keep enforcing: when a
 * `checkout.session.completed` event is processed, the resulting
 * `update` payload preserves any pre-existing `config` keys.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

interface ClinicConfigShape {
  [k: string]: unknown;
}

interface CapturedUpdate {
  config: ClinicConfigShape;
}

const captured: { updates: CapturedUpdate[] } = { updates: [] };

const existingConfig: ClinicConfigShape = {
  timezone: "Africa/Casablanca",
  currency: "MAD",
  workingHours: { mon: ["09:00", "18:00"] },
  slotDuration: 30,
  bufferTime: 5,
  maxAdvanceDays: 60,
  maxPerSlot: 1,
  cancellationHours: 24,
  depositAmount: 0,
  depositPercentage: 0,
  maxRecurringWeeks: 12,
};

vi.mock("@/lib/supabase-server", () => {
  const buildClient = () => ({
    from: vi.fn().mockImplementation(() => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockImplementation((payload: CapturedUpdate) => {
          captured.updates.push(payload);
          return {
            eq: vi.fn().mockResolvedValue({ error: null }),
          };
        }),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { config: existingConfig },
          error: null,
        }),
      };
      return builder;
    }),
  });
  return {
    createClient: vi.fn().mockResolvedValue(buildClient()),
    createAdminClient: vi.fn().mockReturnValue(buildClient()),
  };
});

async function createStripeSignature(
  payload: string,
  secret: string,
  timestamp?: number,
): Promise<string> {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${ts},v1=${hex}`;
}

const TEST_SECRET = "whsec_test_billing_webhook_q01";

describe("billing/webhook — Q-01: clinic config merge", () => {
  beforeEach(() => {
    captured.updates = [];
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_q01");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", TEST_SECRET);
  });

  it("preserves operational config keys when handling checkout.session.completed", async () => {
    const { POST } = await import("@/app/api/billing/webhook/route");
    const payload = JSON.stringify({
      id: "evt_q01_checkout_completed",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_q01_session",
          metadata: {
            clinic_id: "00000000-0000-0000-0000-000000000001",
            plan_id: "starter",
          },
          customer: "cus_q01_customer",
          subscription: "sub_q01_subscription",
        },
      },
    });

    const signature = await createStripeSignature(payload, TEST_SECRET);
    const request = new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
    });

    const response = await POST(request as never);
    expect(response.status).toBe(200);

    expect(captured.updates).toHaveLength(1);
    const written = captured.updates[0].config;

    // Operational keys MUST survive the webhook (the regression).
    expect(written.timezone).toBe("Africa/Casablanca");
    expect(written.currency).toBe("MAD");
    expect(written.workingHours).toEqual({ mon: ["09:00", "18:00"] });
    expect(written.slotDuration).toBe(30);
    expect(written.cancellationHours).toBe(24);
    expect(written.maxRecurringWeeks).toBe(12);

    // Subscription keys MUST be applied.
    expect(written.subscription_plan).toBe("starter");
    expect(written.stripe_customer_id).toBe("cus_q01_customer");
    expect(written.stripe_subscription_id).toBe("sub_q01_subscription");
    expect(written.subscription_status).toBe("active");
    expect(typeof written.subscription_updated_at).toBe("string");
  });
});
