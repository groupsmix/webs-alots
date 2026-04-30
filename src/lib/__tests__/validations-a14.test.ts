import { describe, expect, it } from "vitest";
import {
  CHAT_MESSAGE_CONTENT_MAX,
  CHAT_MESSAGES_MAX,
  chatRequestSchema,
  labReportSchema,
  normalizeText,
  safeName,
  safeText,
} from "@/lib/validations";

describe("normalizeText (A14-04, A14-05)", () => {
  it("strips ASCII NUL bytes", () => {
    expect(normalizeText("foo\u0000bar")).toBe("foobar");
    expect(normalizeText("\u0000\u0000")).toBe("");
  });

  it("normalizes to NFC so composed and decomposed forms match", () => {
    // "é" as NFD (e + COMBINING ACUTE ACCENT) vs NFC ("é").
    const nfd = "Cafe\u0301";
    const nfc = "Café";
    expect(normalizeText(nfd)).toBe(nfc);
    expect(normalizeText(nfd)).toBe(normalizeText(nfc));
  });

  it("is a no-op for ASCII text without control characters", () => {
    expect(normalizeText("plain ascii")).toBe("plain ascii");
  });
});

describe("safeText / safeName transforms", () => {
  it("safeText preserves surrounding whitespace", () => {
    expect(safeText.parse("  hello  ")).toBe("  hello  ");
  });

  it("safeName trims surrounding whitespace after normalization", () => {
    expect(safeName.parse("   Dr. House   ")).toBe("Dr. House");
  });

  it("both reject non-strings", () => {
    expect(safeText.safeParse(42 as unknown as string).success).toBe(false);
    expect(safeName.safeParse({} as unknown as string).success).toBe(false);
  });
});

describe("chatRequestSchema (A14-01)", () => {
  it("accepts a message at exactly the max length", () => {
    const content = "x".repeat(CHAT_MESSAGE_CONTENT_MAX);
    const result = chatRequestSchema.safeParse({
      messages: [{ role: "user", content }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a message longer than the max", () => {
    const content = "x".repeat(CHAT_MESSAGE_CONTENT_MAX + 1);
    const result = chatRequestSchema.safeParse({
      messages: [{ role: "user", content }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty message", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: "user", content: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("strips NUL bytes before length check", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: "user", content: "hi\u0000there" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messages[0].content).toBe("hithere");
    }
  });
});

describe("chatRequestSchema messages array cap (A1-01 / API4)", () => {
  it("accepts exactly CHAT_MESSAGES_MAX messages", () => {
    const messages = Array.from({ length: CHAT_MESSAGES_MAX }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg ${i}`,
    }));
    // Ensure last message is from user (required by schema role enum)
    messages[messages.length - 1] = { role: "user", content: "last" };
    const result = chatRequestSchema.safeParse({ messages });
    expect(result.success).toBe(true);
  });

  it("rejects more than CHAT_MESSAGES_MAX messages", () => {
    const messages = Array.from({ length: CHAT_MESSAGES_MAX + 1 }, () => ({
      role: "user",
      content: "x",
    }));
    const result = chatRequestSchema.safeParse({ messages });
    expect(result.success).toBe(false);
  });
});

describe("labReportSchema testName (A14-03)", () => {
  const baseInput = {
    orderId: "ord-1",
    patientName: "Jane Doe",
    orderNumber: "ON-0001",
  };

  it("accepts a 200-char testName", () => {
    const result = labReportSchema.safeParse({
      ...baseInput,
      results: [
        {
          testName: "T".repeat(200),
          value: null,
          unit: null,
          referenceMin: null,
          referenceMax: null,
          flag: null,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a 201-char testName", () => {
    const result = labReportSchema.safeParse({
      ...baseInput,
      results: [
        {
          testName: "T".repeat(201),
          value: null,
          unit: null,
          referenceMin: null,
          referenceMax: null,
          flag: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
