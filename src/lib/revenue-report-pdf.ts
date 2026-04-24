"use client";

/**
 * Revenue Report PDF Generator
 *
 * Generates a printable HTML report for the accountant that can be
 * saved as PDF via the browser's print dialog (Ctrl+P → Save as PDF).
 * This avoids heavy PDF library dependencies while providing a
 * professional-looking report.
 */

import type { Locale } from "@/lib/i18n";
import { formatCurrency, formatNumber } from "@/lib/utils";

export interface RevenueReportData {
  clinicName: string;
  period: string;
  generatedAt: string;
  currency: string;
  totalRevenue: number;
  totalPatients: number;
  averagePerPatient: number;
  noShowRate: number;
  revenueByDoctor: { doctorName: string; revenue: number; patients: number }[];
  revenueByService: { serviceName: string; revenue: number; count: number }[];
  revenueByMethod: { method: string; revenue: number; count: number; percentage: number }[];
  monthlyBreakdown: { month: string; revenue: number; patients: number; appointments: number }[];
}

/**
 * Open a new window with a printable revenue report.
 * The user can then use Ctrl+P to save as PDF.
 */
export function generateRevenueReport(
  data: RevenueReportData,
  locale: Locale = "fr"
): void {
  const html = buildReportHTML(data, locale);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow pop-ups to generate the PDF report.");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  // Give the browser a moment to render before triggering print
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

function buildReportHTML(data: RevenueReportData, locale: Locale): string {
  const { clinicName, period, generatedAt, currency } = data;

  const doctorRows = data.revenueByDoctor
    .map(
      (d) =>
        `<tr><td>${d.doctorName}</td><td class="num">${formatCurrency(d.revenue, locale, currency)}</td><td class="num">${formatNumber(d.patients, locale)}</td></tr>`,
    )
    .join("");

  const serviceRows = data.revenueByService
    .map(
      (s) =>
        `<tr><td>${s.serviceName}</td><td class="num">${formatCurrency(s.revenue, locale, currency)}</td><td class="num">${formatNumber(s.count, locale)}</td></tr>`,
    )
    .join("");

  const methodRows = data.revenueByMethod
    .map(
      (m) =>
        `<tr><td>${m.method}</td><td class="num">${formatCurrency(m.revenue, locale, currency)}</td><td class="num">${formatNumber(m.count, locale)}</td><td class="num">${formatNumber(m.percentage, locale)}%</td></tr>`,
    )
    .join("");

  const monthlyRows = data.monthlyBreakdown
    .map(
      (m) =>
        `<tr><td>${m.month}</td><td class="num">${formatCurrency(m.revenue, locale, currency)}</td><td class="num">${formatNumber(m.patients, locale)}</td><td class="num">${formatNumber(m.appointments, locale)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Revenue Report - ${clinicName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    h2 { font-size: 16px; margin: 24px 0 12px; border-bottom: 2px solid #2563eb; padding-bottom: 4px; color: #2563eb; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; }
    .header-info { color: #6b7280; font-size: 13px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
    .kpi-value { font-size: 22px; font-weight: 700; color: #1e293b; }
    .kpi-label { font-size: 11px; color: #64748b; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
    th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
    td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 20px; } .kpi-grid { break-inside: avoid; } table { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${clinicName}</h1>
      <p style="color: #6b7280; font-size: 14px;">Monthly Revenue Report</p>
    </div>
    <div class="header-info">
      <p>Period: ${period}</p>
      <p>Generated: ${generatedAt}</p>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-value">${formatCurrency(data.totalRevenue, locale, currency)}</div>
      <div class="kpi-label">Total Revenue</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${data.totalPatients}</div>
      <div class="kpi-label">Patients Seen</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${formatCurrency(data.averagePerPatient, locale, currency)}</div>
      <div class="kpi-label">Avg per Patient</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${data.noShowRate}%</div>
      <div class="kpi-label">No-Show Rate</div>
    </div>
  </div>

  <h2>Monthly Breakdown</h2>
  <table>
    <thead><tr><th>Month</th><th class="num">Revenue</th><th class="num">Patients</th><th class="num">Appointments</th></tr></thead>
    <tbody>${monthlyRows || "<tr><td colspan='4' style='text-align:center;color:#9ca3af'>No data</td></tr>"}</tbody>
  </table>

  <h2>Revenue by Doctor</h2>
  <table>
    <thead><tr><th>Doctor</th><th class="num">Revenue</th><th class="num">Patients</th></tr></thead>
    <tbody>${doctorRows || "<tr><td colspan='3' style='text-align:center;color:#9ca3af'>No data</td></tr>"}</tbody>
  </table>

  <h2>Revenue by Service</h2>
  <table>
    <thead><tr><th>Service</th><th class="num">Revenue</th><th class="num">Count</th></tr></thead>
    <tbody>${serviceRows || "<tr><td colspan='3' style='text-align:center;color:#9ca3af'>No data</td></tr>"}</tbody>
  </table>

  <h2>Revenue by Payment Method</h2>
  <table>
    <thead><tr><th>Method</th><th class="num">Revenue</th><th class="num">Count</th><th class="num">%</th></tr></thead>
    <tbody>${methodRows || "<tr><td colspan='4' style='text-align:center;color:#9ca3af'>No data</td></tr>"}</tbody>
  </table>

  <div class="footer">
    <p>This report was generated automatically by ${clinicName} Health SaaS Platform.</p>
    <p>For questions, contact your clinic administrator.</p>
  </div>
</body>
</html>`;
}
