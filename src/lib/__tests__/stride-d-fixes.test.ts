import { describe, it, expect } from "vitest";
import { sanitizeHtml, SANITIZE_HTML_MAX_LEN } from "../sanitize-html";
import {
  chatRequestSchema,
  CHAT_HISTORY_MAX_MESSAGES,
  CHAT_MESSAGE_MAX_LENGTH,
} from "../validations";

/**
 * STRIDE D-1 / D-3: regression tests for the size bounds added to the
 * chat schema and sanitizeHtml.
 */

describe("STRIDE D-1: chatRequestSchema bounds", () => {
  it("accepts a single short message", () => {
    const r = chatRequestSchema.safeParse({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty messages array", () => {
    const r = chatRequestSchema.safeParse({ messages: [] });
    expect(r.success).toBe(false);
  });

  it("rejects more than CHAT_HISTORY_MAX_MESSAGES messages", () => {
    const messages = Array.from({ length: CHAT_HISTORY_MAX_MESSAGES + 1 }, () => ({
      role: "user" as const,
      content: "hi",
    }));
    const r = chatRequestSchema.safeParse({ messages });
    expect(r.success).toBe(false);
  });

  it("rejects a message longer than CHAT_MESSAGE_MAX_LENGTH", () => {
    const r = chatRequestSchema.safeParse({
      messages: [
        {
          role: "user",
          content: "x".repeat(CHAT_MESSAGE_MAX_LENGTH + 1),
        },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty message string", () => {
    const r = chatRequestSchema.safeParse({
      messages: [{ role: "user", content: "" }],
    });
    expect(r.success).toBe(false);
  });
});

describe("STRIDE D-3: sanitizeHtml input bound", () => {
  it("truncates oversized input before regex evaluation", () => {
    const oversize = "<p>" + "a".repeat(SANITIZE_HTML_MAX_LEN + 100) + "</p>";
    const out = sanitizeHtml(oversize);
    // Output cannot exceed the truncated input size since regex only
    // strips characters; equality of the upper bound is enough.
    expect(out.length).toBeLessThanOrEqual(SANITIZE_HTML_MAX_LEN);
  });

  it("still strips dangerous tags in normal input", () => {
    expect(sanitizeHtml("<script>alert(1)</script><p>ok</p>")).toBe("<p>ok</p>");
  });
});
