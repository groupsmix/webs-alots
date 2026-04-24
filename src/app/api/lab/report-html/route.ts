/**
 * POST /api/lab/report-html — Generate an HTML report for a lab test order
 *
 * Body: { orderId, patientName, orderNumber, results }
 * clinic_id is derived from the authenticated user's profile.
 *
 * Generates an HTML report, uploads to R2, and updates the order's pdf_url.
 * Returns: { pdfUrl }
 */

import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { updateLabOrderPdfUrl } from "@/lib/data/server";
import { escapeHtml } from "@/lib/escape-html";
import { uploadToR2, isR2Configured, buildUploadKey } from "@/lib/r2";
import { formatCurrency, formatNumber, formatDisplayDate } from "@/lib/utils";
import { labReportSchema } from "@/lib/validations";

interface LabResultItem {
  testName: string;
  value: string | null;
  unit: string | null;
  referenceMin: number | null;
  referenceMax: number | null;
  flag: string | null;
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

export const POST = withAuthValidation(labReportSchema, async (body, request, { profile }) => {
    const { orderId, patientName, orderNumber, results } = body;
    // Derive clinic_id from the authenticated user's profile — never from the request body
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("User must belong to a clinic");
    }

    const generatedAt = formatDisplayDate(new Date(), "en", "datetime");

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
      return apiSuccess({ pdfUrl: dataUrl, fallback: true });
    }

    const buffer = Buffer.from(html, "utf-8");
    const url = await uploadToR2(key, buffer, "text/html");

    if (!url) {
      return apiInternalError("Failed to upload report");
    }

    await updateLabOrderPdfUrl(orderId, url);

    return apiSuccess({ pdfUrl: url });
}, STAFF_ROLES);
