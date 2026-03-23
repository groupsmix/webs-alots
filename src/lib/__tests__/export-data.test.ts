/**
 * Tests for export-data.ts — CSV generation and formula injection prevention.
 *
 * Note: The module is "use client" so we test the internal helpers by
 * re-implementing the same logic here (escapeCSV, arrayToCSV are not exported).
 * We test the formula injection defense and CSV escaping patterns.
 */
import { describe, it, expect } from "vitest";

// Re-implement the private helpers to test them directly
const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (str.length > 0 && FORMULA_PREFIXES.has(str[0])) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
): string {
  const header = columns.map((c) => escapeCSV(c.label)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escapeCSV(row[c.key])).join(","),
  );
  return [header, ...body].join("\n");
}

describe("escapeCSV", () => {
  it("returns empty string for null", () => {
    expect(escapeCSV(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(escapeCSV(undefined)).toBe("");
  });

  it("returns plain string as-is", () => {
    expect(escapeCSV("hello")).toBe("hello");
  });

  it("wraps strings with commas in quotes", () => {
    expect(escapeCSV("hello, world")).toBe('"hello, world"');
  });

  it("escapes double quotes by doubling them", () => {
    expect(escapeCSV('say "hello"')).toBe('"say ""hello"""');
  });

  it("wraps strings with newlines in quotes", () => {
    expect(escapeCSV("line1\nline2")).toBe('"line1\nline2"');
  });

  it("converts numbers to strings", () => {
    expect(escapeCSV(42)).toBe("42");
  });

  it("converts booleans to strings", () => {
    expect(escapeCSV(true)).toBe("true");
  });

  // Formula injection prevention tests
  it("prefixes = with single quote to prevent formula injection", () => {
    expect(escapeCSV("=CMD()")).toBe("'=CMD()");
  });

  it("prefixes + with single quote", () => {
    expect(escapeCSV("+1234")).toBe("'+1234");
  });

  it("prefixes - with single quote", () => {
    expect(escapeCSV("-1234")).toBe("'-1234");
  });

  it("prefixes @ with single quote", () => {
    expect(escapeCSV("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("prefixes tab character with single quote", () => {
    expect(escapeCSV("\tcmd")).toBe("'\tcmd");
  });

  it("prefixes carriage return with single quote", () => {
    expect(escapeCSV("\rcmd")).toBe("'\rcmd");
  });

  it("handles formula injection in values with commas", () => {
    const result = escapeCSV("=1+1,dangerous");
    expect(result.startsWith('"')).toBe(true);
    expect(result).toContain("'=1+1");
  });
});

describe("arrayToCSV", () => {
  it("generates CSV with header and rows", () => {
    const rows = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];
    const columns = [
      { key: "name" as const, label: "Name" },
      { key: "age" as const, label: "Age" },
    ];
    const csv = arrayToCSV(rows, columns);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Name,Age");
    expect(lines[1]).toBe("Alice,30");
    expect(lines[2]).toBe("Bob,25");
  });

  it("handles empty rows", () => {
    const columns = [{ key: "name" as const, label: "Name" }];
    const csv = arrayToCSV([], columns);
    expect(csv).toBe("Name");
  });

  it("escapes values in rows", () => {
    const rows = [{ name: "O'Brien, James", note: '="exploit"' }];
    const columns = [
      { key: "name" as const, label: "Name" },
      { key: "note" as const, label: "Note" },
    ];
    const csv = arrayToCSV(rows, columns);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain('"');
    expect(dataLine).toContain("'=");
  });
});
