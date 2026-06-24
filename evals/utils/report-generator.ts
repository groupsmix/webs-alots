import fs from "fs";
import path from "path";

/** Escape untrusted strings before interpolating into HTML (prevents injection). */
function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SuiteSummary {
  name: string;
  status: "PASS" | "FAIL";
}

export interface ReportSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  suites: SuiteSummary[];
}

/**
 * Render the aggregate HTML report. Every interpolated value is HTML-escaped —
 * a previous version inlined values directly, which would allow HTML/script
 * injection if any suite name or metric ever carried markup.
 *
 * Returns the path of the written report.
 */
export function generateHtmlReport(summary: ReportSummary, outputDir: string): string {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const rows = summary.suites
    .map((s) => {
      const cls = s.status === "FAIL" ? "fail" : "pass";
      return `    <tr class="${cls}">
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.status)}</td>
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
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>AI Medical Evaluation Report</h1>
  <p>Date: ${escapeHtml(new Date().toISOString())}</p>

  <h2>Summary</h2>
  <p>Total suites: ${escapeHtml(summary.total)}</p>
  <p class="pass">Passed: ${escapeHtml(summary.passed)} (${escapeHtml(summary.passRate.toFixed(1))}%)</p>
  <p class="${summary.failed > 0 ? "fail" : "pass"}">Failed: ${escapeHtml(summary.failed)}</p>

  <h2>Per-suite results</h2>
  <table>
    <thead>
      <tr><th>Suite</th><th>Status</th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <p>See the CLI output for per-case failure detail.</p>
</body>
</html>`;

  const outputPath = path.join(outputDir, `report-${Date.now()}.html`);
  fs.writeFileSync(outputPath, html);
  return outputPath;
}
