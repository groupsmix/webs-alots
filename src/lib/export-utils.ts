"use client";

import { escapeCSV } from "@/lib/csv-escape";
import { getLocalDateStr } from "@/lib/utils";

/**
 * Super-admin data export utilities — CSV download and print-based PDF
 * for subscription, billing, feature, and dashboard data.
 *
 * Uses browser-native approaches only (no heavy deps):
 *   - CSV: BOM-prefixed UTF-8 Blob → anchor download
 *   - PDF: Hidden print-optimized iframe → window.print()
 */

// ── CSV helpers ──────────────────────────────────────────────────────

/**
 * Convert an array of objects to CSV and trigger a browser download.
 * Prepends UTF-8 BOM for proper French character handling in Excel.
 */
export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;

  const keys = Object.keys(data[0]);
  const header = keys.map((k) => escapeCSV(k)).join(",");
  const rows = data.map((row) => keys.map((k) => escapeCSV(row[k])).join(","));
  const csv = [header, ...rows].join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── PDF helpers (browser print) ─────────────────────────────────────

/**
 * Generate a print-optimized HTML table and open the browser print
 * dialog so the user can save as PDF.
 */
export function exportToPDF(
  title: string,
  data: Record<string, unknown>[],
  columns: string[],
): void {
  if (data.length === 0) return;

  const dateStr = getLocalDateStr();

  const tableRows = data
    .map(
      (row) =>
        `<tr>${columns.map((col) => `<td style="border:1px solid #ddd;padding:6px 10px;font-size:12px;">${escapeHTML(String(row[col] ?? ""))}</td>`).join("")}</tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHTML(title)}</title>
  <style>
    @media print {
      @page { margin: 15mm; size: A4 landscape; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; margin: 0; padding: 20px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #666; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; border: 1px solid #ddd; padding: 8px 10px; font-size: 12px; text-align: left; font-weight: 600; }
    td { border: 1px solid #ddd; padding: 6px 10px; font-size: 12px; }
    tr:nth-child(even) { background: #fafafa; }
  </style>
</head>
<body>
  <h1>${escapeHTML(title)}</h1>
  <p class="meta">Généré le ${escapeHTML(dateStr)} — Oltigo Health</p>
  <table>
    <thead><tr>${columns.map((col) => `<th>${escapeHTML(col)}</th>`).join("")}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}<\/script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
