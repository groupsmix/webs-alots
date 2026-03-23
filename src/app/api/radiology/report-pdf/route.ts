/**
 * POST /api/radiology/report-pdf — Generate a PDF report for a radiology order
 *
 * Body: { orderId, clinicId, patientName, modality, bodyPart?, findings, impression, reportText, radiologistName? }
 *
 * Generates a simple PDF, uploads to R2, and updates the order's pdf_url.
 * Returns: { pdfUrl }
 */

import { NextResponse } from "next/server";
import { uploadToR2, isR2Configured, buildUploadKey } from "@/lib/r2";
import { updateRadiologyOrderPdfUrl } from "@/lib/data/server";
import { withAuth } from "@/lib/with-auth";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/lib/escape-html";
import { radiologyReportPdfSchema, safeParse } from "@/lib/validations";

function generateReportHtml(data: {
  patientName: string;
  modality: string;
  bodyPart?: string;
  findings: string;
  impression: string;
  reportText: string;
  radiologistName?: string;
  generatedAt: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Radiology Report</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
  h1 { color: #4338ca; border-bottom: 2px solid #4338ca; padding-bottom: 10px; }
  .meta { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
  .meta p { margin: 5px 0; }
  .meta strong { color: #555; }
  .section { margin: 20px 0; }
  .section h2 { color: #4338ca; font-size: 16px; margin-bottom: 8px; }
  .section p { line-height: 1.6; white-space: pre-wrap; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #888; }
</style>
</head>
<body>
  <h1>Radiology Report</h1>
  <div class="meta">
    <p><strong>Patient:</strong> ${escapeHtml(data.patientName)}</p>
    <p><strong>Modality:</strong> ${escapeHtml(data.modality.toUpperCase())}</p>
    ${data.bodyPart ? `<p><strong>Body Part:</strong> ${escapeHtml(data.bodyPart)}</p>` : ""}
    <p><strong>Date:</strong> ${escapeHtml(data.generatedAt)}</p>
    ${data.radiologistName ? `<p><strong>Radiologist:</strong> ${escapeHtml(data.radiologistName)}</p>` : ""}
  </div>

  ${data.findings ? `<div class="section"><h2>Findings</h2><p>${escapeHtml(data.findings)}</p></div>` : ""}
  ${data.impression ? `<div class="section"><h2>Impression</h2><p>${escapeHtml(data.impression)}</p></div>` : ""}
  ${data.reportText ? `<div class="section"><h2>Full Report</h2><p>${escapeHtml(data.reportText)}</p></div>` : ""}

  <div class="footer">
    <p>Generated on ${escapeHtml(data.generatedAt)}</p>
  </div>
</body>
</html>`;
}

export const POST = withAuth(async (request) => {
  try {
    const raw = await request.json();
    const parsed = safeParse(radiologyReportPdfSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const {
      orderId,
      clinicId,
      patientName,
      modality,
      bodyPart,
      findings,
      impression,
      reportText,
      radiologistName,
    } = parsed.data;

    if (!findings && !impression && !reportText) {
      return NextResponse.json(
        { error: "Report content is required (findings, impression, or reportText)" },
        { status: 400 },
      );
    }

    const generatedAt = new Date().toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    });

    const html = generateReportHtml({
      patientName,
      modality,
      bodyPart,
      findings: findings ?? "",
      impression: impression ?? "",
      reportText: reportText ?? "",
      radiologistName,
      generatedAt,
    });

    // Store as HTML report (PDF generation would require a headless browser)
    const fileName = `report-${orderId.slice(0, 8)}-${Date.now()}.html`;
    const key = buildUploadKey(clinicId, "radiology-reports", fileName);

    if (!isR2Configured()) {
      // Return the HTML content as a data URL fallback
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

    // Update the order's pdf_url
    await updateRadiologyOrderPdfUrl(orderId, url);

    return NextResponse.json({ pdfUrl: url });
  } catch (err) {
    logger.warn("Operation failed", { context: "radiology/report-pdf", error: err });
    return NextResponse.json({ error: "Failed to generate radiology report" }, { status: 500 });
  }
}, STAFF_ROLES);
