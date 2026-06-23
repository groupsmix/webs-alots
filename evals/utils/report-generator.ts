import fs from "fs";
import path from "path";
import type { SuiteResult } from "./results-io";

/** Escape untrusted strings before interpolating into HTML (prevents injection). */
function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface AggregateSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  suites: SuiteResult[];
}

export function generateHtmlReport(summary: AggregateSummary, outputDir: string): string {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const rows = summary.suites
    .map((s) => {
      const cls = s.skipped ? "skip" : s.failed > 0 ? "fail" : "pass";
      const status = s.skipped ? "SKIPPED" : s.failed > 0 ? "FAIL" : "PASS";
      return `    <tr class="${cls}">
      <td>${escapeHtml(s.suite)}</td>
      <td>${escapeHtml(status)}</td>
      <td>${escapeHtml(s.total)}</td>
      <td>${escapeHtml(s.passed)}</td>
      <td>${escapeHtml(s.failed)}</td>
      <td>${escapeHtml(s.passRate.toFixed(1))}%</td>
    </tr>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AI Medical Evaluation Report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 40px; color: #333; }
    h1 { color: #2c3e50; }
    .pass { color: #27ae60; }
    .fail { color: #c0392b; }
    .skip { color: #7f8c8d; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>AI Medical Evaluation Report</h1>
  <p>Date: ${escapeHtml(new Date().toISOString())}</p>

  <h2>Summary</h2>
  <p>Total evaluated cases: ${escapeHtml(summary.total)}</p>
  <p class="pass">Passed: ${escapeHtml(summary.passed)} (${escapeHtml(summary.passRate.toFixed(1))}%)</p>
  <p class="${summary.failed > 0 ? "fail" : "pass"}">Failed: ${escapeHtml(summary.failed)}</p>

  <h2>Per-suite results</h2>
  <table>
    <thead>
      <tr><th>Suite</th><th>Status</th><th>Total</th><th>Passed</th><th>Failed</th><th>Pass rate</th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>`;

  const outputPath = path.join(outputDir, `report-${Date.now()}.html`);
  fs.writeFileSync(outputPath, html);
  return outputPath;
}
