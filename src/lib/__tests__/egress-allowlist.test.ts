import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock logger before importing the module
vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("egress-allowlist", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isEgressAllowed", () => {
    it("allows known hosts like api.openai.com", async () => {
      const { isEgressAllowed } = await import("@/lib/egress-allowlist");
      expect(isEgressAllowed("https://api.openai.com/v1/chat")).toBe(true);
    });

    it("allows Stripe API", async () => {
      const { isEgressAllowed } = await import("@/lib/egress-allowlist");
      expect(isEgressAllowed("https://api.stripe.com/v1/charges")).toBe(true);
    });

    it("allows Supabase project host from env", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://myproject.supabase.co";
      const { isEgressAllowed } = await import("@/lib/egress-allowlist");
      expect(isEgressAllowed("https://myproject.supabase.co/rest/v1/table")).toBe(true);
    });

    it("allows subdomains of known hosts", async () => {
      const { isEgressAllowed } = await import("@/lib/egress-allowlist");
      expect(isEgressAllowed("https://o12345.sentry.io/api/event")).toBe(true);
    });

    it("blocks unknown hosts", async () => {
      const { isEgressAllowed } = await import("@/lib/egress-allowlist");
      expect(isEgressAllowed("https://evil.example.com/exfil")).toBe(false);
    });

    it("blocks invalid URLs", async () => {
      const { isEgressAllowed } = await import("@/lib/egress-allowlist");
      expect(isEgressAllowed("not-a-url")).toBe(false);
    });

    // A50-1: SSRF guard — private/reserved IP ranges
    it("blocks loopback IPv4 (127.0.0.1)", async () => {
      const { isEgressAllowed } = await import("@/lib/egress-allowlist");
      expect(isEgressAllowed("http://127.0.0.1/secret")).toBe(false);
    });

    it("blocks cloud metadata endpoint (169.254.169.254)", async () => {
      const { isEgressAllowed } = await import("@/lib/egress-allowlist");
      expect(isEgressAllowed("http://169.254.169.254/latest/meta-data/")).toBe(false);
    });

    it("blocks private 10.x.x.x range", async () => {
      const { isEgressAllowed } = await import("@/lib/egress-allowlist");
      expect(isEgressAllowed("http://10.0.0.1/internal")).toBe(false);
    });

    it("blocks private 192.168.x.x range", async () => {
      const { isEgressAllowed } = await import("@/lib/egress-allowlist");
      expect(isEgressAllowed("http://192.168.1.1/admin")).toBe(false);
    });

    it("blocks private 172.16-31.x.x range", async () => {
      const { isEgressAllowed } = await import("@/lib/egress-allowlist");
      expect(isEgressAllowed("http://172.16.0.1/internal")).toBe(false);
      expect(isEgressAllowed("http://172.31.255.255/internal")).toBe(false);
    });

    it("blocks 0.0.0.0", async () => {
      const { isEgressAllowed } = await import("@/lib/egress-allowlist");
      expect(isEgressAllowed("http://0.0.0.0/")).toBe(false);
    });

    it("blocks IPv6 loopback (::1)", async () => {
      const { isEgressAllowed } = await import("@/lib/egress-allowlist");
      expect(isEgressAllowed("http://[::1]/secret")).toBe(false);
    });

    it("allows CMI payment gateway", async () => {
      const { isEgressAllowed } = await import("@/lib/egress-allowlist");
      expect(isEgressAllowed("https://payment.cmi.co.ma/callback")).toBe(true);
      expect(isEgressAllowed("https://testpayment.cmi.co.ma/callback")).toBe(true);
    });
  });

  describe("fetchAllowlisted", () => {
    // A39-2: Default is enforce mode (EGRESS_ALLOWLIST_ENFORCE !== "false")
    it("throws by default (enforce mode on) when host is blocked", async () => {
      delete process.env.EGRESS_ALLOWLIST_ENFORCE;
      const { fetchAllowlisted } = await import("@/lib/egress-allowlist");
      await expect(fetchAllowlisted("https://evil.example.com/exfil")).rejects.toThrow(
        "A39.2: Egress blocked",
      );
    });

    it("throws when enforce is explicitly true", async () => {
      process.env.EGRESS_ALLOWLIST_ENFORCE = "true";
      const { fetchAllowlisted } = await import("@/lib/egress-allowlist");
      await expect(fetchAllowlisted("https://evil.example.com/exfil")).rejects.toThrow(
        "A39.2: Egress blocked",
      );
    });

    it("logs warning but proceeds when enforce is explicitly false", async () => {
      process.env.EGRESS_ALLOWLIST_ENFORCE = "false";
      const { fetchAllowlisted } = await import("@/lib/egress-allowlist");
      const { logger } = await import("@/lib/logger");

      // Mock global fetch
      const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
      vi.stubGlobal("fetch", mockFetch);

      await fetchAllowlisted("https://evil.example.com/exfil");
      expect(logger.warn).toHaveBeenCalledWith(
        "Egress fetch to non-allowlisted host",
        expect.objectContaining({ hostname: "evil.example.com" }),
      );
      expect(mockFetch).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });
});
