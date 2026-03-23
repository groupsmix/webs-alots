/**
 * POST /api/lab/report-html — Generate an HTML report for a lab test order
 *
 * Body: { orderId, clinicId, patientName, orderNumber, results }
 *
 * Generates an HTML report, uploads to R2, and updates the order's pdf_url.
 * Returns: { pdfUrl }
 */

import { NextResponse } from "next/server";
import { uploadToR2, isR2Configured, buildUploadKey } from "@/lib/r2";
import { updateLabOrderPdfUrl } from "@/lib/data/server";
import { withAuth } from "@/lib/with-auth";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";

interface LabResultItem {
  testName: string;
  value: string | null;
  unit: string | null;
  referenceMin: number | null;
  referenceMax: number | null;
  flag: string | null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function flagLabel(flag: string | null): string {
  if (!flag || flag === "normal") return "";
  return flag.replace("_", " ").toUpperCase();
}

function flagColor(flag: string | null): string {
  if (flag === "critical_high" || flag === "critical_low") return "#dc2626";
  if (flag === "high") return "#ea580c";
  if (flag === "low") return "#ca8a04";
  return "#16a34a";
}

function generateLabReportHtml(data: {
  patientName: string;
  orderNumber: string;
  results: LabResultItem[];
  generatedAt: string;
}): string {
  const resultRows = data.results
    .map((r) => {
      const ref =
        r.referenceMin != null && r.referenceMax != null
          ? `${r.referenceMin} - ${r.referenceMax}`
          : r.referenceMin != null
            ? `>= ${r.referenceMin}`
            : r.referenceMax != null
              ? `<= ${r.referenceMax}`
              : "&mdash;";

      const fl = flagLabel(r.flag);
      const flStyle = fl ? `color: ${flagColor(r.flag)}; font-weight: bold;` : "";

      return `<tr>
        <td>${escapeHtml(r.testName)}</td>
        <td>${r.value ? escapeHtml(r.value) : "&mdash;"}</td>
        <td>${r.unit ? escapeHtml(r.unit) : ""}</td>
        <td>${ref}</td>
        <td style="${flStyle}">${fl || "Normal"}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Lab Report — ${escapeHtml(data.orderNumber)}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
  h1 { color: #0d9488; border-bottom: 2px solid #0d9488; padding-bottom: 10px; }
  .meta { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
  .meta p { margin: 5px 0; }
  .meta strong { color: #555; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th { background: #f0fdfa; color: #0d9488; text-align: left; padding: 10px 8px; border-bottom: 2px solid #0d9488; font-size: 13px; }
  td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #888; }
</style>
</head>
<body>
  <h1>Laboratory Report</h1>
  <div class="meta">
    <p><strong>Patient:</strong> ${escapeHtml(data.patientName)}</p>
    <p><strong>Order:</strong> ${escapeHtml(data.orderNumber)}</p>
    <p><strong>Date:</strong> ${escapeHtml(data.generatedAt)}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Test</th>
        <th>Value</th>
        <th>Unit</th>
        <th>Reference Range</th>
        <th>Flag</th>
      </tr>
    </thead>
    <tbody>
      ${resultRows}
    </tbody>
  </table>

  <div class="footer">
    <p>Generated on ${escapeHtml(data.generatedAt)}</p>
  </div>
</body>
</html>`;
}

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { orderId, clinicId, patientName, orderNumber, results } = body;

    if (!orderId || !clinicId || !patientName || !orderNumber) {
      return NextResponse.json(
        { error: "orderId, clinicId, patientName, and orderNumber are required" },
        { status: 400 },
      );
    }

    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: "At least one result is required" },
        { status: 400 },
      );
    }

    const generatedAt = new Date().toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    });

    const html = generateLabReportHtml({
      patientName,
      orderNumber,
      results: results as LabResultItem[],
      generatedAt,
    });

    const fileName = `lab-report-${orderId.slice(0, 8)}-${Date.now()}.html`;
    const key = buildUploadKey(clinicId, "lab-reports", fileName);

    if (!isR2Configured()) {
      const dataUrl = `data:text/html;base64,${Buffer.from(html).toString("base64")}`;
      return NextResponse.json({ pdfUrl: dataUrl, fallback: true });
    }

    const buffer = Buffer.from(html, "utf-8");
    const url = await uploadToR2(key, buffer, "text/html");

    if (!url) {
      return NextResponse.json(
        { error: "Failed to upload report" },
        { status: 500 },
      );
    }

    await updateLabOrderPdfUrl(orderId, url);

    return NextResponse.json({ pdfUrl: url });
  } catch (err) {
    logger.warn("Operation failed", { context: "route", error: err });
    return NextResponse.json({ error: "Failed to generate lab report" }, { status: 500 });
  }
}, STAFF_ROLES);
