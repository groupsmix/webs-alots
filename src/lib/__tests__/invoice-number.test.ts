import { describe, it, expect } from "vitest";
import { isValidInvoiceNumberFormat, parseInvoiceNumber } from "@/lib/invoice-number";

/**
 * Tests for invoice number utilities (A164-01).
 *
 * The allocateInvoiceNumber function requires a real Supabase connection
 * (it calls an RPC), so we test the format validation and parsing helpers
 * here. The RPC itself is tested via migration-level SQL tests.
 */

describe("isValidInvoiceNumberFormat", () => {
  it("accepts valid format YYYY-NNNNNN", () => {
    expect(isValidInvoiceNumberFormat("2026-000001")).toBe(true);
    expect(isValidInvoiceNumberFormat("2024-123456")).toBe(true);
    expect(isValidInvoiceNumberFormat("2020-000000")).toBe(true);
  });

  it("rejects missing year", () => {
    expect(isValidInvoiceNumberFormat("-000001")).toBe(false);
  });

  it("rejects missing sequence", () => {
    expect(isValidInvoiceNumberFormat("2026-")).toBe(false);
  });

  it("rejects short sequence (< 6 digits)", () => {
    expect(isValidInvoiceNumberFormat("2026-00001")).toBe(false);
    expect(isValidInvoiceNumberFormat("2026-1")).toBe(false);
  });

  it("rejects long sequence (> 6 digits)", () => {
    expect(isValidInvoiceNumberFormat("2026-0000001")).toBe(false);
  });

  it("rejects non-numeric characters", () => {
    expect(isValidInvoiceNumberFormat("ABCD-000001")).toBe(false);
    expect(isValidInvoiceNumberFormat("2026-ABCDEF")).toBe(false);
  });

  it("rejects free-form text", () => {
    expect(isValidInvoiceNumberFormat("INV-2026-001")).toBe(false);
    expect(isValidInvoiceNumberFormat("some-invoice")).toBe(false);
    expect(isValidInvoiceNumberFormat("")).toBe(false);
  });

  it("rejects missing separator", () => {
    expect(isValidInvoiceNumberFormat("2026000001")).toBe(false);
  });
});

describe("parseInvoiceNumber", () => {
  it("parses valid format into year and sequence", () => {
    const result = parseInvoiceNumber("2026-000001");
    expect(result).toEqual({ year: 2026, sequence: 1 });
  });

  it("parses larger sequence numbers", () => {
    const result = parseInvoiceNumber("2024-123456");
    expect(result).toEqual({ year: 2024, sequence: 123456 });
  });

  it("parses zero sequence", () => {
    const result = parseInvoiceNumber("2020-000000");
    expect(result).toEqual({ year: 2020, sequence: 0 });
  });

  it("returns null for invalid format", () => {
    expect(parseInvoiceNumber("")).toBeNull();
    expect(parseInvoiceNumber("INV-001")).toBeNull();
    expect(parseInvoiceNumber("2026-1")).toBeNull();
    expect(parseInvoiceNumber("bad")).toBeNull();
  });
});
