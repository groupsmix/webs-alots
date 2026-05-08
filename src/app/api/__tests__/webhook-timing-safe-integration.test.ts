/**
 * Integration tests for Webhook Timing-Safe Compare (A2-02)
 *
 * Tests that all webhook handlers properly reject oversized signatures
 * and use timing-safe comparison for signature verification.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(),
}));

// Helper to create mock request with signature
function createMockWebhookRequest(
  body: string,
  signature: string,
  endpoint: "whatsapp" | "stripe" | "cmi"
): NextRequest {
  const headers: Record<string, string> = {};
  
  switch (endpoint) {
    case "whatsapp":
      headers["x-hub-signature-256"] = signature;
      break;
    case "stripe":
      headers["stripe-signature"] = signature;
      break;
    case "cmi":
      // CMI uses form data, not headers
      break;
  }

  return new NextRequest("http://localhost:3000/api/webhooks", {
    method: "POST",
    headers,
    body,
  });
}

describe("Webhook Timing-Safe Compare Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock environment variables
    process.env.WHATSAPP_APP_SECRET = "test-whatsapp-secret";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test-stripe-secret";
    process.env.CMI_SECRET_KEY = "test-cmi-secret";
  });

  describe("WhatsApp Webhook Handler", () => {
    it("should reject oversized signature header", async () => {
      const normalBody = JSON.stringify({ entry: [] });
      const oversizedSignature = "sha256=" + "a".repeat(2000); // > 1024 limit

      const request = createMockWebhookRequest(normalBody, oversizedSignature, "whatsapp");

      const { POST } = await import("@/app/api/webhooks/route");
      const response = await POST(request);

      // Should be unauthorized due to signature rejection
      expect(response.status).toBe(401);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        ok: false,
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    });

    it("should accept legitimate signature within size limits", async () => {
      const body = JSON.stringify({ entry: [] });
      
      // Generate valid signature
      const { hmacSha256Hex } = await import("@/lib/crypto-utils");
      const validSignature = await hmacSha256Hex("test-whatsapp-secret", body);
      
      const request = createMockWebhookRequest(body, `sha256=${validSignature}`, "whatsapp");

      const { POST } = await import("@/app/api/webhooks/route");
      const response = await POST(request);

      // Should succeed (or fail for other reasons, but not signature)
      expect(response.status).not.toBe(401);
    });

    it("should reject signature without sha256 prefix", async () => {
      const body = JSON.stringify({ entry: [] });
      const { hmacSha256Hex } = await import("@/lib/crypto-utils");
      const signature = await hmacSha256Hex("test-whatsapp-secret", body);
      
      // Missing "sha256=" prefix
      const request = createMockWebhookRequest(body, signature, "whatsapp");

      const { POST } = await import("@/app/api/webhooks/route");
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("should use timing-safe comparison for signature verification", async () => {
      const body = JSON.stringify({ entry: [] });
      const wrongSignature = "sha256=" + "b".repeat(64); // Wrong but correct length

      const request = createMockWebhookRequest(body, wrongSignature, "whatsapp");

      // Spy on timingSafeEqual to ensure it's called
      const cryptoUtils = await import("@/lib/crypto-utils");
      const timingSafeEqualSpy = vi.spyOn(cryptoUtils, "timingSafeEqual");

      const { POST } = await import("@/app/api/webhooks/route");
      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(timingSafeEqualSpy).toHaveBeenCalled();
    });
  });

  describe("Stripe Webhook Handler", () => {
    it("should reject oversized signature header", async () => {
      const normalBody = JSON.stringify({ type: "payment_intent.succeeded" });
      const timestamp = Math.floor(Date.now() / 1000);
      const oversizedSignature = `t=${timestamp},v1=${"a".repeat(2000)}`; // > 1024 limit

      const request = createMockWebhookRequest(normalBody, oversizedSignature, "stripe");

      const { POST } = await import("@/app/api/payments/webhook/route");
      const response = await POST(request);

      // Should be unauthorized due to signature rejection
      expect(response.status).toBe(401);
    });

    it("should accept legitimate signature within size limits", async () => {
      const body = JSON.stringify({ type: "payment_intent.succeeded" });
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Generate valid signature
      const { hmacSha256Hex } = await import("@/lib/crypto-utils");
      const signedPayload = `${timestamp}.${body}`;
      const validSignature = await hmacSha256Hex("test-stripe-secret", signedPayload);
      
      const stripeSignature = `t=${timestamp},v1=${validSignature}`;
      const request = createMockWebhookRequest(body, stripeSignature, "stripe");

      const { POST } = await import("@/app/api/payments/webhook/route");
      const response = await POST(request);

      // Should not fail due to signature (may fail for other reasons)
      expect(response.status).not.toBe(401);
    });

    it("should reject expired timestamp", async () => {
      const body = JSON.stringify({ type: "payment_intent.succeeded" });
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 400; // > 300s ago
      
      const { hmacSha256Hex } = await import("@/lib/crypto-utils");
      const signedPayload = `${expiredTimestamp}.${body}`;
      const validSignature = await hmacSha256Hex("test-stripe-secret", signedPayload);
      
      const stripeSignature = `t=${expiredTimestamp},v1=${validSignature}`;
      const request = createMockWebhookRequest(body, stripeSignature, "stripe");

      const { POST } = await import("@/app/api/payments/webhook/route");
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("should use timing-safe comparison for signature verification", async () => {
      const body = JSON.stringify({ type: "payment_intent.succeeded" });
      const timestamp = Math.floor(Date.now() / 1000);
      const wrongSignature = `t=${timestamp},v1=${"b".repeat(64)}`; // Wrong but correct format

      const request = createMockWebhookRequest(body, wrongSignature, "stripe");

      // Spy on timingSafeEqual to ensure it's called
      const cryptoUtils = await import("@/lib/crypto-utils");
      const timingSafeEqualSpy = vi.spyOn(cryptoUtils, "timingSafeEqual");

      const { POST } = await import("@/app/api/payments/webhook/route");
      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(timingSafeEqualSpy).toHaveBeenCalled();
    });
  });

  describe("CMI Payment Callback", () => {
    it("should reject oversized hash parameter", async () => {
      const { verifyCmiCallback } = await import("@/lib/cmi");
      
      const normalParams = {
        clientid: "test-client",
        amount: "100.00",
        currency: "504", // MAD
        ProcReturnCode: "00",
      };
      
      const oversizedHash = "a".repeat(2000); // > 1024 limit
      
      const result = await verifyCmiCallback(normalParams, oversizedHash);
      
      // Should return null (invalid)
      expect(result).toBeNull();
    });

    it("should accept legitimate hash within size limits", async () => {
      const { verifyCmiCallback, generateHash } = await import("@/lib/cmi");
      
      const params = {
        clientid: "test-client",
        amount: "100.00",
        currency: "504", // MAD
        ProcReturnCode: "00",
      };
      
      // Generate valid hash
      const config = { secretKey: "test-cmi-secret" };
      const fieldsToHash = ["clientid", "amount", "currency", "ProcReturnCode"];
      const validHash = await generateHash(fieldsToHash, config.secretKey);
      
      // Mock the config
      vi.doMock("@/lib/cmi", async () => {
        const actual = await vi.importActual("@/lib/cmi");
        return {
          ...actual,
          getCmiConfig: vi.fn().mockReturnValue(config),
        };
      });
      
      const result = await verifyCmiCallback(params, validHash);
      
      // Should not be null (valid)
      expect(result).not.toBeNull();
    });

    it("should use timing-safe comparison for hash verification", async () => {
      const { verifyCmiCallback } = await import("@/lib/cmi");
      
      const params = {
        clientid: "test-client",
        amount: "100.00",
        currency: "504",
        ProcReturnCode: "00",
      };
      
      const wrongHash = "b".repeat(64); // Wrong but correct length
      
      // Spy on timingSafeEqual to ensure it's called
      const cryptoUtils = await import("@/lib/crypto-utils");
      const timingSafeEqualSpy = vi.spyOn(cryptoUtils, "timingSafeEqual");
      
      const result = await verifyCmiCallback(params, wrongHash);
      
      expect(result).toBeNull();
      expect(timingSafeEqualSpy).toHaveBeenCalled();
    });
  });

  describe("Performance Under Attack", () => {
    it("should handle multiple oversized signature attempts efficiently", async () => {
      const body = JSON.stringify({ entry: [] });
      const oversizedSignature = "sha256=" + "a".repeat(10000);
      
      const requests = Array(10).fill(null).map(() => 
        createMockWebhookRequest(body, oversizedSignature, "whatsapp")
      );

      const { POST } = await import("@/app/api/webhooks/route");
      
      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(req => POST(req))
      );
      const duration = Date.now() - startTime;

      // All should be rejected quickly
      responses.forEach(response => {
        expect(response.status).toBe(401);
      });
      
      // Should complete in reasonable time (not proportional to signature size)
      expect(duration).toBeLessThan(1000); // 1 second for 10 requests
    });

    it("should not leak timing information for different signature lengths", async () => {
      const body = JSON.stringify({ entry: [] });
      const { hmacSha256Hex } = await import("@/lib/crypto-utils");
      
      // Generate signatures of different lengths (but all wrong)
      const shortWrongSig = "sha256=" + "a".repeat(32);
      const longWrongSig = "sha256=" + "b".repeat(64);
      
      const { POST } = await import("@/app/api/webhooks/route");
      
      // Time both requests
      const startShort = Date.now();
      const shortResponse = await POST(createMockWebhookRequest(body, shortWrongSig, "whatsapp"));
      const shortDuration = Date.now() - startShort;
      
      const startLong = Date.now();
      const longResponse = await POST(createMockWebhookRequest(body, longWrongSig, "whatsapp"));
      const longDuration = Date.now() - startLong;
      
      // Both should be rejected
      expect(shortResponse.status).toBe(401);
      expect(longResponse.status).toBe(401);
      
      // Timing difference should be minimal (within 50ms tolerance)
      expect(Math.abs(shortDuration - longDuration)).toBeLessThan(50);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty signature gracefully", async () => {
      const body = JSON.stringify({ entry: [] });
      const request = createMockWebhookRequest(body, "", "whatsapp");

      const { POST } = await import("@/app/api/webhooks/route");
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("should handle malformed signature header", async () => {
      const body = JSON.stringify({ entry: [] });
      const malformedSignature = "not-a-signature";
      const request = createMockWebhookRequest(body, malformedSignature, "whatsapp");

      const { POST } = await import("@/app/api/webhooks/route");
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("should handle unicode characters in signature", async () => {
      const body = JSON.stringify({ entry: [] });
      const unicodeSignature = "sha256=héllo🌍";
      const request = createMockWebhookRequest(body, unicodeSignature, "whatsapp");

      const { POST } = await import("@/app/api/webhooks/route");
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("should handle null bytes in signature", async () => {
      const body = JSON.stringify({ entry: [] });
      const nullByteSignature = "sha256=test\x00signature";
      const request = createMockWebhookRequest(body, nullByteSignature, "whatsapp");

      const { POST } = await import("@/app/api/webhooks/route");
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe("Regression Tests", () => {
    it("should not allocate memory proportional to signature size (A2-02)", async () => {
      const body = JSON.stringify({ entry: [] });
      
      // Create progressively larger signatures
      const signatures = [
        "sha256=" + "a".repeat(100),
        "sha256=" + "a".repeat(1000),
        "sha256=" + "a".repeat(5000),
        "sha256=" + "a".repeat(10000),
      ];

      const { POST } = await import("@/app/api/webhooks/route");
      
      // All should be rejected in similar time (not proportional to size)
      const times: number[] = [];
      
      for (const signature of signatures) {
        const request = createMockWebhookRequest(body, signature, "whatsapp");
        
        const start = Date.now();
        const response = await POST(request);
        const duration = Date.now() - start;
        
        expect(response.status).toBe(401);
        times.push(duration);
      }
      
      // Verify times don't grow proportionally with signature size
      // (allowing for some variance due to system load)
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      // Max time should not be more than 3x min time
      expect(maxTime / minTime).toBeLessThan(3);
    });

    it("should maintain constant-time comparison for equal-length signatures", async () => {
      const body = JSON.stringify({ entry: [] });
      const { hmacSha256Hex } = await import("@/lib/crypto-utils");
      
      // Generate correct signature
      const correctSignature = await hmacSha256Hex("test-whatsapp-secret", body);
      
      // Create wrong signature of same length
      const wrongSignature = "a".repeat(correctSignature.length);
      
      const { POST } = await import("@/app/api/webhooks/route");
      
      // Time both comparisons multiple times
      const correctTimes: number[] = [];
      const wrongTimes: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        // Test correct signature
        const correctRequest = createMockWebhookRequest(body, `sha256=${correctSignature}`, "whatsapp");
        const startCorrect = Date.now();
        await POST(correctRequest);
        correctTimes.push(Date.now() - startCorrect);
        
        // Test wrong signature
        const wrongRequest = createMockWebhookRequest(body, `sha256=${wrongSignature}`, "whatsapp");
        const startWrong = Date.now();
        await POST(wrongRequest);
        wrongTimes.push(Date.now() - startWrong);
      }
      
      // Average times should be similar (within 20ms tolerance)
      const avgCorrect = correctTimes.reduce((a, b) => a + b) / correctTimes.length;
      const avgWrong = wrongTimes.reduce((a, b) => a + b) / wrongTimes.length;
      
      expect(Math.abs(avgCorrect - avgWrong)).toBeLessThan(20);
    });
  });
});