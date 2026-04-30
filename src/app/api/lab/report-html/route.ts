/**
 * POST /api/lab/report-html — Generate a lab report for a lab test order
 *
 * Body: { orderId, patientName, orderNumber, results }
 * clinic_id is derived from the authenticated user's profile.
 *
 * The report is rendered as a protected HTML artifact, encrypted at rest
 * via `encryptAndUpload`, and served through the authenticated download
 * route. The route never returns a public R2 URL — only an authenticated
 * download path that re-validates the caller's clinic and role.
 *
 * Returns: { reportKey, downloadUrl, pdfUrl }
 *   - reportKey:   the underlying R2 key (without `.enc` suffix)
 *   - downloadUrl: `/api/files/download?key=<reportKey>`
 *   - pdfUrl:      same as downloadUrl, kept for backward compatibility
 *                  with existing UI callers that read `data.pdfUrl`.
 */

import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { updateLabOrderPdfUrl } from "@/lib/data/server";
import { isEncryptionConfigured } from "@/lib/encryption";
import { escapeHtml } from "@/lib/escape-html";
import { getDirection, isRTL, t, type Locale } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import { buildUploadKey } from "@/lib/r2";
import { encryptAndUpload } from "@/lib/r2-encrypted";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { formatCurrency, formatNumber, formatDisplayDate } from "@/lib/utils";
import { labReportSchema } from "@/lib/validations";

const SUPPORTED_LOCALES: readonly Locale[] = ["fr", "ar", "en"] as const;
const DEFAULT_LOCALE: Locale = "fr";

function normalizeLocale(value: string | null | undefined): Locale {
  if (!value) return DEFAULT_LOCALE;
  return SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

function resolveLocale(request: Request): Locale {
  // Priority: explicit cookie set by the locale switcher → tenant default header → fallback.
  // Stays consistent with src/app/layout.tsx which reads the same sources.
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch = /(?:^|;\s*)preferred-locale=([^;]+)/.exec(cookieHeader);
  if (cookieMatch) {
    return normalizeLocale(decodeURIComponent(cookieMatch[1]));
  }
  const tenantLocale = request.headers.get("x-tenant-locale");
  if (tenantLocale) {
    return normalizeLocale(tenantLocale);
  }
  return DEFAULT_LOCALE;
}

interface LabResultItem {
  testName: string;
  value: string | null;
  unit: string | null;
  referenceMin: number | null;
  referenceMax: number | null;
  flag: string | null;
}

function flagLabel(locale: Locale, flag: string | null): string {
  if (!flag || flag === "normal") return "";
  switch (flag) {
    case "high":
      return t(locale, "lab.report.flagHigh");
    case "low":
      return t(locale, "lab.report.flagLow");
    case "critical_high":
      return t(locale, "lab.report.flagCriticalHigh");
    case "critical_low":
      return t(locale, "lab.report.flagCriticalLow");
    default:
      return flag.replace("_", " ").toUpperCase();
  }
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
  locale: Locale;
}): string {
  const { locale } = data;
  const dir = getDirection(locale);
  const rtl = isRTL(locale);
  // CSS logical alignment so RTL renders mirrored without per-property overrides.
  const textAlign = rtl ? "right" : "left";

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

      const fl = flagLabel(locale, r.flag);
      const flStyle = fl ? `color: ${flagColor(r.flag)}; font-weight: bold;` : "";
      const normalLabel = t(locale, "lab.report.flagNormal");

      return `<tr>
        <td>${escapeHtml(r.testName)}</td>
        <td>${r.value ? escapeHtml(r.value) : "&mdash;"}</td>
        <td>${r.unit ? escapeHtml(r.unit) : ""}</td>
        <td>${ref}</td>
        <td style="${flStyle}">${fl || escapeHtml(normalLabel)}</td>
      </tr>`;
    })
    .join("\n");

  const documentTitle = t(locale, "lab.report.documentTitle", { orderNumber: data.orderNumber });
  const heading = t(locale, "lab.report.title");
  const labelPatient = t(locale, "lab.report.patient");
  const labelOrder = t(locale, "lab.report.order");
  const labelDate = t(locale, "lab.report.date");
  const colTest = t(locale, "lab.report.colTest");
  const colValue = t(locale, "lab.report.colValue");
  const colUnit = t(locale, "lab.report.colUnit");
  const colReference = t(locale, "lab.report.colReference");
  const colFlag = t(locale, "lab.report.colFlag");
  const footer = t(locale, "lab.report.footer", { generatedAt: data.generatedAt });

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(documentTitle)}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; text-align: ${textAlign}; }
  h1 { color: #0d9488; border-bottom: 2px solid #0d9488; padding-bottom: 10px; }
  .meta { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
  .meta p { margin: 5px 0; }
  .meta strong { color: #555; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th { background: #f0fdfa; color: #0d9488; text-align: ${textAlign}; padding: 10px 8px; border-bottom: 2px solid #0d9488; font-size: 13px; }
  td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #888; }
</style>
</head>
<body>
  <h1>${escapeHtml(heading)}</h1>
  <div class="meta">
    <p><strong>${escapeHtml(labelPatient)}:</strong> ${escapeHtml(data.patientName)}</p>
    <p><strong>${escapeHtml(labelOrder)}:</strong> ${escapeHtml(data.orderNumber)}</p>
    <p><strong>${escapeHtml(labelDate)}:</strong> ${escapeHtml(data.generatedAt)}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>${escapeHtml(colTest)}</th>
        <th>${escapeHtml(colValue)}</th>
        <th>${escapeHtml(colUnit)}</th>
        <th>${escapeHtml(colReference)}</th>
        <th>${escapeHtml(colFlag)}</th>
      </tr>
    </thead>
    <tbody>
      ${resultRows}
    </tbody>
  </table>

  <div class="footer">
    <p>${escapeHtml(footer)}</p>
  </div>
</body>
</html>`;
}

/**
 * Sanitize the order number for use as a file basename so we don't introduce
 * path separators or `.enc` collisions through user-influenced data.
 */
function sanitizeOrderNumber(orderNumber: string): string {
  return orderNumber.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export const POST = withAuthValidation(labReportSchema, async (body, request, { supabase, profile }) => {
    const { orderId, patientName, orderNumber, results } = body;
    // Derive clinic_id from the authenticated user's profile — never from the request body
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("User must belong to a clinic");
    }

    // Fail closed if PHI encryption is not configured.
    //
    // `encryptAndUpload` has a non-production plaintext fallback (no `.enc`
    // suffix) for local convenience, but `downloadAndDecrypt` always reads
    // the `.enc` object — so a plaintext upload here would produce a report
    // that the download route can never serve. Refusing up-front avoids the
    // asymmetry and guarantees lab reports only land in encrypted storage,
    // matching the Moroccan Law 09-08 PHI handling requirement.
    if (!isEncryptionConfigured()) {
      logger.error("Lab report generation refused: PHI encryption not configured", {
        context: "api/lab/report-html",
        clinicId,
        orderId,
      });
      return apiError(
        "Encrypted report storage is not configured. Contact the administrator.",
        503,
        "ENCRYPTION_NOT_CONFIGURED",
      );
    }

    const locale = resolveLocale(request);
    const generatedAt = formatDisplayDate(new Date(), locale, "datetime");

    const html = generateLabReportHtml({
      patientName,
      orderNumber,
      results: results as LabResultItem[],
      generatedAt,
      locale,
    });

    // Look up the order so we can (1) confirm tenant ownership and (2) audit
    // the patient context. If the order doesn't belong to this clinic we
    // refuse before writing any PHI to storage.
    const { data: order, error: orderError } = await supabase
      .from("lab_test_orders")
      .select("id, clinic_id, patient_id")
      .eq("id", orderId)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (orderError) {
      logger.warn("Failed to load lab order for report generation", {
        context: "api/lab/report-html",
        orderId,
        error: orderError,
      });
      return apiInternalError("Failed to load order");
    }
    if (!order) {
      return apiError("Lab order not found", 404, "NOT_FOUND");
    }

    // Tenant-scoped key under the encrypted PHI namespace.
    // buildUploadKey() produces `clinics/{clinicId}/lab-reports/{timestamp}-{rand}-{hashedName}`
    // and `encryptAndUpload()` appends `.enc` for the stored object.
    const fileName = `${sanitizeOrderNumber(orderNumber)}.html`;
    const reportKey = buildUploadKey(clinicId, "lab-reports", fileName);

    const buffer = Buffer.from(html, "utf-8");
    const stored = await encryptAndUpload(reportKey, buffer, "text/html", {
      clinicId,
      category: "lab-reports",
      patientId: order.patient_id ?? null,
    });

    if (!stored) {
      // Either R2 is not configured or PHI encryption is missing in production.
      // Fail closed — we never fall back to a data: URL because that would
      // ship raw PHI HTML inline to the caller.
      return apiError(
        "Encrypted report storage is not configured. Contact the administrator.",
        503,
        "STORAGE_NOT_CONFIGURED",
      );
    }

    // Only an authenticated download route is exposed to the caller. The
    // underlying R2 URL is never surfaced — that path bypasses tenant + role
    // re-checks and would leak PHI if the URL were ever shared.
    const downloadUrl = `/api/files/download?key=${encodeURIComponent(reportKey)}`;

    await updateLabOrderPdfUrl(orderId, downloadUrl);

    await logAuditEvent({
      supabase,
      action: "lab_report_generated",
      type: "patient",
      clinicId,
      actor: profile.id,
      description: `Lab report for order ${orderNumber} stored at ${reportKey}`,
      metadata: {
        orderId,
        orderNumber,
        reportKey,
        patientId: order.patient_id ?? null,
      },
    });

    return apiSuccess({
      reportKey,
      downloadUrl,
      // Backward-compat field for existing UI callers that read `pdfUrl`.
      pdfUrl: downloadUrl,
    });
}, STAFF_ROLES);
