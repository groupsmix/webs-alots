import { describe, it, expect, vi, beforeEach } from "vitest";
import { safeFetch, wouldEgressBeAllowed } from "@/lib/fetch-wrapper";

describe("fetch-wrapper", () => {
  beforeEach(() => {
    vi.stubEnv("EGRESS_ALLOWLIST_ENFORCE", "true");
  });

  describe("safeFetch", () => {
    it("allows requests to allowed domains", async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response("ok"));

      await safeFetch("https://api.stripe.com/v1/test");

      expect(global.fetch).toHaveBeenCalled();
    });

    it("blocks requests to non-allowed domains when enforcement enabled", async () => {
      await expect(safeFetch("https://malicious-site.com/exfiltrate")).rejects.toThrow(
        /Egress blocked/,
      );
    });

    it("allows requests when enforcement disabled", async () => {
      vi.stubEnv("EGRESS_ALLOWLIST_ENFORCE", "false");
      global.fetch = vi.fn().mockResolvedValue(new Response("ok"));

      await safeFetch("https://any-domain.com/api");

      expect(global.fetch).toHaveBeenCalled();
    });

    it("allows subdomains of allowed domains", async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response("ok"));

      await safeFetch("https://my-project.supabase.co/rest/v1/users");

      expect(global.fetch).toHaveBeenCalled();
    });

    it("allows the HIBP breach-check host", async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response("ok"));

      await safeFetch("https://api.pwnedpasswords.com/range/ABCDE");

      expect(global.fetch).toHaveBeenCalled();
    });

    it("allows the Mailgun email relay host", async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response("ok"));

      await safeFetch("https://api.mailgun.net/v3/mg.example.com/messages");

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("wouldEgressBeAllowed", () => {
    it("returns true for allowed URLs", () => {
      expect(wouldEgressBeAllowed("https://api.stripe.com/v1/test")).toBe(true);
    });

    it("returns false for non-allowed URLs", () => {
      expect(wouldEgressBeAllowed("https://malicious.com/api")).toBe(false);
    });

    it("returns false for invalid URLs", () => {
      expect(wouldEgressBeAllowed("not-a-url")).toBe(false);
    });
  });
});
