/**
 * Tests for the pure-function pieces of `src/lib/support/ai.ts`:
 * - `heuristicSupportTriage` (deterministic keyword classifier)
 * - `mapSupportPriorityToAiPriority`
 *
 * The AI-backed `maybeGenerate*` paths are exercised at integration-test level
 * with the AI router mocked, so they are intentionally excluded here. Keeping
 * this unit test focused keeps the suite fast and avoids re-mocking the entire
 * provider config pipeline.
 */

import { describe, it, expect, vi } from "vitest";
import {
  heuristicSupportTriage,
  mapSupportPriorityToAiPriority,
  SUPPORT_TRIAGE_CATEGORIES,
} from "../ai";

vi.mock("@/lib/supabase-server", () => ({
  createUntypedAdminClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("heuristicSupportTriage", () => {
  it("classifies billing/payment terms (EN + FR)", () => {
    expect(heuristicSupportTriage("My invoice is wrong").category).toBe("billing_payment");
    expect(heuristicSupportTriage("Problème de facture stripe").category).toBe("billing_payment");
  });

  it("classifies technical bugs", () => {
    expect(heuristicSupportTriage("I got a 500 error when saving").category).toBe(
      "technical_bug",
    );
    expect(heuristicSupportTriage("App is slow and times out").category).toBe("technical_bug");
  });

  it("classifies account_access requests", () => {
    expect(heuristicSupportTriage("Need help with my password reset").category).toBe(
      "account_access",
    );
    expect(heuristicSupportTriage("MFA OTP not arriving").category).toBe("account_access");
  });

  it("classifies whatsapp_notifications terms", () => {
    expect(heuristicSupportTriage("WhatsApp template not delivered").category).toBe(
      "whatsapp_notifications",
    );
  });

  it("classifies KYC/onboarding", () => {
    expect(heuristicSupportTriage("KYC verification documents stuck").category).toBe(
      "kyc_onboarding",
    );
  });

  it("classifies data_privacy and flags the GDPR/Loi 09-08 toggle", () => {
    const result = heuristicSupportTriage("Please delete my data per GDPR");
    expect(result.category).toBe("data_privacy");
    expect(result.isDataPrivacyRequest).toBe(true);
  });

  it("falls back to 'other' when nothing matches", () => {
    const result = heuristicSupportTriage("Random text with no keywords whatsoever");
    expect(result.category).toBe("other");
    expect(result.isDataPrivacyRequest).toBe(false);
  });

  it("escalates priority for urgent keywords (EN + FR)", () => {
    expect(heuristicSupportTriage("urgent: site is down").priority).toBe("urgent");
    expect(heuristicSupportTriage("c'est critical").priority).toBe("urgent");
    expect(heuristicSupportTriage("le service est en panne").priority).toBe("urgent");
  });

  it("maps technical_bug / account_access to high priority when not urgent", () => {
    // "bug" matches technical_bug; none of the URGENT_KEYWORDS appear.
    expect(heuristicSupportTriage("There's a bug in the form").priority).toBe("high");
    // "password reset" matches account_access; no urgent keywords.
    expect(heuristicSupportTriage("Need help with my password reset").priority).toBe("high");
  });

  it("maps feature_request to low priority", () => {
    expect(heuristicSupportTriage("Feature request: dark mode please").priority).toBe("low");
  });

  it("defaults to normal priority for unclassified content", () => {
    expect(heuristicSupportTriage("Random text with no keywords").priority).toBe("normal");
  });

  it("estimates resolution hours by priority", () => {
    expect(heuristicSupportTriage("urgent down").estimatedResolutionHours).toBe(4);
    expect(heuristicSupportTriage("bug in form").estimatedResolutionHours).toBe(8);
    expect(heuristicSupportTriage("nothing in particular").estimatedResolutionHours).toBe(24);
    expect(heuristicSupportTriage("feature request").estimatedResolutionHours).toBe(72);
  });

  it("uses a privacy-specific suggested reply for data_privacy tickets", () => {
    const result = heuristicSupportTriage("Please export my personal data");
    expect(result.suggestedReply).toMatch(/conformité|données|identité/i);
  });

  it("uses an urgent suggested reply for urgent tickets", () => {
    const result = heuristicSupportTriage("urgent fail on production");
    expect(result.suggestedReply).toMatch(/prioritaire|rapidement/i);
  });

  it("truncates summary to 220 chars", () => {
    const longInput = "a".repeat(500);
    const result = heuristicSupportTriage(longInput);
    expect(result.summary.length).toBeLessThanOrEqual(220);
  });

  it("returns a valid schema with confidence between 0 and 1", () => {
    const result = heuristicSupportTriage("hi");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(SUPPORT_TRIAGE_CATEGORIES).toContain(result.category);
  });
});

describe("mapSupportPriorityToAiPriority", () => {
  it("maps the four support priorities to AI-router priorities", () => {
    expect(mapSupportPriorityToAiPriority("urgent")).toBe("critical");
    expect(mapSupportPriorityToAiPriority("high")).toBe("high");
    expect(mapSupportPriorityToAiPriority("normal")).toBe("medium");
    expect(mapSupportPriorityToAiPriority("low")).toBe("low");
  });
});
