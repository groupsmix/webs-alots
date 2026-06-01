/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";

export function generateHtmlReport(metricsSummary: any, outputDir: string) {
  const html = `
<!DOCTYPE html>
<html>
<head>
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
  <p>Date: ${new Date().toISOString()}</p>
  
  <h2>Summary</h2>
  <p>Total Cases: ${metricsSummary.total}</p>
  <p class="pass">Passed: ${metricsSummary.passed} (${metricsSummary.passRate}%)</p>
  <p class="${metricsSummary.failed > 0 ? "fail" : "pass"}">Failed: ${metricsSummary.failed}</p>
  
  <h2>Details</h2>
  <p>Run the CLI output or view artifact JSON for full failure details.</p>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, `report-${Date.now()}.html`), html);
}
