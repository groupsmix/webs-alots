import { describe, it, expect } from "vitest";
import { readWebhookBody } from "@/lib/webhook-body";

function createMockRequest(body: string): Request {
  return new Request("https://example.com/webhook", {
    method: "POST",
    body,
  });
}

describe("readWebhookBody", () => {
  it("returns decoded string for a body under the limit", async () => {
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const result = await readWebhookBody(createMockRequest(payload));
    expect(result).toBe(payload);
  });

  it("returns null when body exceeds the limit", async () => {
    const oversized = "x".repeat(2 * 1024 * 1024);
    const result = await readWebhookBody(createMockRequest(oversized), 1024 * 1024);
    expect(result).toBeNull();
  });

  it("returns empty string for a request with no body", async () => {
    const req = new Request("https://example.com/webhook", { method: "POST" });
    const result = await readWebhookBody(req);
    expect(result).toBe("");
  });

  it("respects a custom maxBytes parameter", async () => {
    const payload = "a".repeat(500);
    const result = await readWebhookBody(createMockRequest(payload), 100);
    expect(result).toBeNull();
  });

  it("returns body exactly at the limit", async () => {
    const payload = "b".repeat(100);
    const result = await readWebhookBody(createMockRequest(payload), 100);
    expect(result).toBe(payload);
  });
});
