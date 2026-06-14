import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import {
  applyRequestScopedResponseHeaders,
  clearInternalRateLimitRequestHeaders,
  setInternalRateLimitRequestHeaders,
} from "@/lib/request-context-response-headers";

describe("request-context-response-headers", () => {
  it("copies internal rate-limit request headers onto the response", () => {
    const request = new NextRequest("https://oltigo.com/api/test");
    const mutatedHeaders = new Headers(request.headers);
    setInternalRateLimitRequestHeaders(mutatedHeaders, {
      limit: 60,
      remaining: 59,
      reset: 1_717_171_717,
    });

    const response = NextResponse.json({ ok: true });
    applyRequestScopedResponseHeaders({ headers: mutatedHeaders }, response);

    expect(response.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("59");
    expect(response.headers.get("X-RateLimit-Reset")).toBe("1717171717");
  });

  it("clears stale internal request headers before middleware recomputes them", () => {
    const headers = new Headers({
      "x-oltigo-ratelimit-limit": "100",
      "x-oltigo-ratelimit-remaining": "0",
      "x-oltigo-ratelimit-reset": "123",
    });

    clearInternalRateLimitRequestHeaders(headers);

    expect(headers.get("x-oltigo-ratelimit-limit")).toBeNull();
    expect(headers.get("x-oltigo-ratelimit-remaining")).toBeNull();
    expect(headers.get("x-oltigo-ratelimit-reset")).toBeNull();
  });
});
