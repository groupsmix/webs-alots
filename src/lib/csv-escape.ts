/**
 * Shared CSV escaping utility.
 *
 * Secures against CSV formula injection. A cell whose first character is
 * =, +, -, @, or a TAB/CR will be evaluated as a formula by Excel and
 * Google Sheets. Prefix such values with a single quote so the value
 * is rendered as plain text.
 */

const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function escapeCSV(v: unknown): string {
  if (v === null || v === undefined) return "";

  let str = String(v);
  if (str.length > 0 && FORMULA_PREFIXES.has(str[0])) {
    str = `'${str}`;
  }

  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
