import { describe, it, expect } from "vitest";
import { safeJsonLdStringify } from "../json-ld";

describe("safeJsonLdStringify", () => {
  it("serializes a simple object", () => {
    const result = safeJsonLdStringify({ name: "Test" });
    expect(result).toBe('{"name":"Test"}');
  });

  it("escapes < characters to prevent script injection", () => {
    const result = safeJsonLdStringify({ value: "</script>" });
    expect(result).toContain("\\u003c");
    expect(result).not.toContain("<");
  });

  it("handles nested objects", () => {
    const data = { "@type": "Organization", name: "Clinic<script>" };
    const result = safeJsonLdStringify(data);
    expect(result).not.toContain("<");
    expect(JSON.parse(result.replace(/\\u003c/g, "<"))).toEqual(data);
  });

  it("handles arrays", () => {
    const data = ["<b>bold</b>", "normal"];
    const result = safeJsonLdStringify(data);
    expect(result).not.toContain("<");
  });

  it("handles strings with multiple < characters", () => {
    const result = safeJsonLdStringify({ html: "<div><span></span></div>" });
    expect(result).not.toContain("<");
    // Count the number of \u003c replacements
    const matches = result.match(/\\u003c/g);
    expect(matches).toHaveLength(4);
  });

  it("handles empty object", () => {
    expect(safeJsonLdStringify({})).toBe("{}");
  });

  it("handles null", () => {
    expect(safeJsonLdStringify(null)).toBe("null");
  });

  it("handles numbers and booleans", () => {
    const data = { count: 42, active: true };
    const result = safeJsonLdStringify(data);
    expect(result).toBe('{"count":42,"active":true}');
  });
});
