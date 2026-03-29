/**
 * Moroccan Invoice Generator
 *
 * Generates legally compliant Moroccan invoices with:
 * - 20% TVA calculation
 * - MAD currency formatting
 * - Proper French legal fields (ICE, IF, RC, CNSS, Patente)
 * - Print-ready format
 */

import {
  calculateTVA,
  formatMAD,
  formatMADFormal,
  type TVARate,
  type MoroccanPaymentMethod,
  type PatientInsurance,
  calculateResteACharge,
} from "./morocco";
import { escapeHtml } from "./escape-html";
import { clinicConfig } from "@/config/clinic.config";

// ---- Invoice Types ----

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  tvaRate: TVARate;
  discount?: number; // percentage
}

export interface ClinicLegalInfo {
  name: string;
  address: string;
  city: string;
  phone: string;
  email?: string;
  /** Identifiant Commun de l'Entreprise */
  ice: string;
  /** Identifiant Fiscal */
  identifiantFiscal: string;
  /** Registre de Commerce */
  rc: string;
  /** Numéro CNSS employeur */
  cnss?: string;
  /** Numéro de Patente */
  patente?: string;
  /** Numéro d'autorisation d'exercice */
  autorisationExercice?: string;
}

export interface InvoiceData {
  /** Invoice number (must be sequential per fiscal year) */
  invoiceNumber: string;
  /** Invoice date */
  date: string;
  /** Due date */
  dueDate?: string;
  /** Clinic/doctor legal information */
  clinic: ClinicLegalInfo;
  /** Patient information */
  patient: {
    name: string;
    address?: string;
    phone?: string;
    ice?: string; // if patient is a company
    insurance?: PatientInsurance;
  };
  /** Line items */
  items: InvoiceLineItem[];
  /** Payment method used */
  paymentMethod?: MoroccanPaymentMethod;
  /** Payment reference */
  paymentReference?: string;
  /** Is this a proforma / devis? */
  isProforma?: boolean;
  /** Additional notes */
  notes?: string;
}

export interface InvoiceTotals {
  subtotalHT: number;
  totalDiscount: number;
  totalHT: number;
  tvaBreakdown: { rate: string; baseAmount: number; tvaAmount: number }[];
  totalTVA: number;
  totalTTC: number;
  insuranceCovered: number;
  mutuelleCovered: number;
  resteACharge: number;
}

// ---- Calculation ----

/**
 * Calculate all invoice totals including TVA breakdown.
 */
export function calculateInvoiceTotals(invoice: InvoiceData): InvoiceTotals {
  let subtotalHT = 0;
  let totalDiscount = 0;
  const tvaMap = new Map<string, { baseAmount: number; tvaAmount: number }>();

  for (const item of invoice.items) {
    const lineTotal = item.quantity * item.unitPrice;
    const discountAmount = item.discount ? lineTotal * (item.discount / 100) : 0;
    const lineHT = lineTotal - discountAmount;

    subtotalHT += lineTotal;
    totalDiscount += discountAmount;

    const tva = calculateTVA(lineHT, item.tvaRate);
    const rateKey = tva.tvaRateLabel;
    const existing = tvaMap.get(rateKey);
    if (existing) {
      existing.baseAmount += tva.amountHT;
      existing.tvaAmount += tva.tvaAmount;
    } else {
      tvaMap.set(rateKey, { baseAmount: tva.amountHT, tvaAmount: tva.tvaAmount });
    }
  }

  const totalHT = subtotalHT - totalDiscount;
  const totalTVA = Array.from(tvaMap.values()).reduce((sum, v) => sum + v.tvaAmount, 0);
  const totalTTC = Math.round((totalHT + totalTVA) * 100) / 100;

  const tvaBreakdown = Array.from(tvaMap.entries()).map(([rate, values]) => ({
    rate,
    baseAmount: Math.round(values.baseAmount * 100) / 100,
    tvaAmount: Math.round(values.tvaAmount * 100) / 100,
  }));

  // Insurance calculation
  let insuranceCovered = 0;
  let mutuelleCovered = 0;
  let resteACharge = totalTTC;

  if (invoice.patient.insurance) {
    const coverage = calculateResteACharge(totalTTC, invoice.patient.insurance);
    insuranceCovered = coverage.insuranceCovered;
    mutuelleCovered = coverage.mutuelleCovered;
    resteACharge = coverage.resteACharge;
  }

  return {
    subtotalHT: Math.round(subtotalHT * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    totalHT: Math.round(totalHT * 100) / 100,
    tvaBreakdown,
    totalTVA: Math.round(totalTVA * 100) / 100,
    totalTTC,
    insuranceCovered: Math.round(insuranceCovered * 100) / 100,
    mutuelleCovered: Math.round(mutuelleCovered * 100) / 100,
    resteACharge: Math.round(resteACharge * 100) / 100,
  };
}

// ---- Invoice Number Generation ----

/**
 * Generate a sequential invoice number for the fiscal year.
 * Format: YYYY-NNNNN (e.g., 2026-00042)
 */
export function generateInvoiceNumber(year: number, sequence: number): string {
  return `${year}-${sequence.toString().padStart(5, "0")}`;
}

/**
 * Generate a proforma/devis number.
 * Format: DEV-YYYY-NNNN
 */
export function generateProformaNumber(year: number, sequence: number): string {
  return `DEV-${year}-${sequence.toString().padStart(4, "0")}`;
}

// ---- Print-Ready HTML Generation ----

/**
 * Generate print-ready HTML for a Moroccan invoice.
 * Compliant with DGI requirements.
 */
export function generateInvoiceHTML(invoice: InvoiceData): string {
  const totals = calculateInvoiceTotals(invoice);
  const isProforma = invoice.isProforma ?? false;
  const title = isProforma ? "DEVIS / Proforma" : "FACTURE";

  return `<!DOCTYPE html>
<html lang="${clinicConfig.locale ?? "fr"}" dir="${clinicConfig.locale === "ar" ? "rtl" : "ltr"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} ${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #333; padding: 20mm; }
    .invoice { max-width: 210mm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #2563eb; }
    .clinic-info h1 { font-size: 18px; color: #2563eb; margin-bottom: 5px; }
    .clinic-info p { font-size: 10px; line-height: 1.6; color: #666; }
    .legal-ids { font-size: 9px; color: #888; margin-top: 8px; }
    .legal-ids span { margin-right: 12px; }
    .invoice-meta { text-align: right; }
    .invoice-meta h2 { font-size: 22px; color: #2563eb; margin-bottom: 8px; }
    .invoice-meta p { font-size: 11px; line-height: 1.6; }
    .parties { display: flex; justify-content: space-between; margin: 20px 0; }
    .party { width: 48%; padding: 12px; border-radius: 6px; }
    .party-emitter { background: #f0f4ff; }
    .party-recipient { background: #f8f8f8; border: 1px solid #e0e0e0; }
    .party h3 { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 6px; letter-spacing: 0.5px; }
    .party p { font-size: 11px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    thead th { background: #2563eb; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
    thead th:last-child, thead th:nth-child(n+3) { text-align: right; }
    tbody td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
    tbody td:last-child, tbody td:nth-child(n+3) { text-align: right; }
    .totals { display: flex; justify-content: flex-end; margin: 15px 0; }
    .totals-table { width: 280px; }
    .totals-table tr td { padding: 5px 10px; font-size: 11px; }
    .totals-table tr td:last-child { text-align: right; font-weight: 500; }
    .totals-table .total-row { border-top: 2px solid #2563eb; }
    .totals-table .total-row td { font-size: 14px; font-weight: 700; color: #2563eb; padding-top: 8px; }
    .insurance-section { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 12px; margin: 15px 0; }
    .insurance-section h4 { font-size: 11px; color: #166534; margin-bottom: 6px; }
    .insurance-section p { font-size: 10px; line-height: 1.6; }
    .payment-info { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px; margin: 15px 0; }
    .payment-info h4 { font-size: 11px; color: #92400e; margin-bottom: 4px; }
    .notes { font-size: 10px; color: #666; margin: 15px 0; padding: 10px; background: #f9fafb; border-radius: 4px; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 9px; color: #999; }
    .footer p { margin-bottom: 3px; }
    .stamp-area { margin-top: 20px; display: flex; justify-content: space-between; }
    .stamp-area div { width: 45%; text-align: center; }
    .stamp-area p { font-size: 10px; color: #666; border-top: 1px dashed #ccc; padding-top: 8px; margin-top: 60px; }
    @media print {
      body { padding: 10mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="clinic-info">
        <h1>${escapeHtml(invoice.clinic.name)}</h1>
        <p>${escapeHtml(invoice.clinic.address)}<br>${escapeHtml(invoice.clinic.city)}</p>
        <p>Tél: ${escapeHtml(invoice.clinic.phone)}${invoice.clinic.email ? `<br>Email: ${escapeHtml(invoice.clinic.email)}` : ""}</p>
        <div class="legal-ids">
          <span>ICE: ${escapeHtml(invoice.clinic.ice)}</span>
          <span>IF: ${escapeHtml(invoice.clinic.identifiantFiscal)}</span>
          <span>RC: ${escapeHtml(invoice.clinic.rc)}</span>
          ${invoice.clinic.patente ? `<span>Patente: ${escapeHtml(invoice.clinic.patente)}</span>` : ""}
          ${invoice.clinic.cnss ? `<span>CNSS: ${escapeHtml(invoice.clinic.cnss)}</span>` : ""}
        </div>
      </div>
      <div class="invoice-meta">
        <h2>${title}</h2>
        <p><strong>N°:</strong> ${escapeHtml(invoice.invoiceNumber)}</p>
        <p><strong>Date:</strong> ${escapeHtml(invoice.date)}</p>
        ${invoice.dueDate ? `<p><strong>Échéance:</strong> ${escapeHtml(invoice.dueDate)}</p>` : ""}
      </div>
    </div>

    <div class="parties">
      <div class="party party-emitter">
        <h3>Émetteur</h3>
        <p><strong>${escapeHtml(invoice.clinic.name)}</strong></p>
        <p>${escapeHtml(invoice.clinic.address)}, ${escapeHtml(invoice.clinic.city)}</p>
        ${invoice.clinic.autorisationExercice ? `<p>Autorisation: ${escapeHtml(invoice.clinic.autorisationExercice)}</p>` : ""}
      </div>
      <div class="party party-recipient">
        <h3>Patient / Client</h3>
        <p><strong>${escapeHtml(invoice.patient.name)}</strong></p>
        ${invoice.patient.address ? `<p>${escapeHtml(invoice.patient.address)}</p>` : ""}
        ${invoice.patient.phone ? `<p>Tél: ${escapeHtml(invoice.patient.phone)}</p>` : ""}
        ${invoice.patient.ice ? `<p>ICE: ${escapeHtml(invoice.patient.ice)}</p>` : ""}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Désignation</th>
          <th>Qté</th>
          <th>P.U. HT</th>
          <th>Remise</th>
          <th>TVA</th>
          <th>Total HT</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items.map((item) => {
          const lineTotal = item.quantity * item.unitPrice;
          const discountAmount = item.discount ? lineTotal * (item.discount / 100) : 0;
          const lineHT = lineTotal - discountAmount;
          const tva = calculateTVA(lineHT, item.tvaRate);
          return `<tr>
            <td>${escapeHtml(item.description)}</td>
            <td>${item.quantity}</td>
            <td>${formatMAD(item.unitPrice, { showCurrency: false })}</td>
            <td>${item.discount ? `${item.discount}%` : "-"}</td>
            <td>${tva.tvaRateLabel}</td>
            <td>${formatMAD(lineHT, { showCurrency: false })}</td>
          </tr>`;
        }).join("\n        ")}
      </tbody>
    </table>

    <div class="totals">
      <table class="totals-table">
        <tr>
          <td>Total HT</td>
          <td>${formatMADFormal(totals.totalHT)}</td>
        </tr>
        ${totals.tvaBreakdown.map((tva) => `<tr>
          <td>TVA ${tva.rate} (base: ${formatMAD(tva.baseAmount, { showCurrency: false })})</td>
          <td>${formatMADFormal(tva.tvaAmount)}</td>
        </tr>`).join("\n        ")}
        <tr class="total-row">
          <td>Total TTC</td>
          <td>${formatMADFormal(totals.totalTTC)}</td>
        </tr>
        ${totals.insuranceCovered > 0 ? `<tr>
          <td>Prise en charge assurance</td>
          <td>- ${formatMADFormal(totals.insuranceCovered)}</td>
        </tr>` : ""}
        ${totals.mutuelleCovered > 0 ? `<tr>
          <td>Prise en charge mutuelle</td>
          <td>- ${formatMADFormal(totals.mutuelleCovered)}</td>
        </tr>` : ""}
        ${invoice.patient.insurance ? `<tr class="total-row">
          <td>Reste à charge patient</td>
          <td>${formatMADFormal(totals.resteACharge)}</td>
        </tr>` : ""}
      </table>
    </div>

    ${invoice.patient.insurance ? `<div class="insurance-section">
      <h4>Informations Assurance</h4>
      <p>N° Affiliation: ${escapeHtml(invoice.patient.insurance.affiliationNumber)}</p>
      ${invoice.patient.insurance.mutuelle ? `<p>Mutuelle: ${escapeHtml(invoice.patient.insurance.mutuelle.name)} (N° ${escapeHtml(invoice.patient.insurance.mutuelle.registrationNumber)})</p>` : ""}
    </div>` : ""}

    ${invoice.paymentMethod ? `<div class="payment-info">
      <h4>Mode de paiement: ${escapeHtml(invoice.paymentMethod)}</h4>
      ${invoice.paymentReference ? `<p>Référence: ${escapeHtml(invoice.paymentReference)}</p>` : ""}
    </div>` : ""}

    ${invoice.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</div>` : ""}

    <div class="stamp-area">
      <div>
        <p>Cachet et signature du praticien</p>
      </div>
      <div>
        <p>Signature du patient</p>
      </div>
    </div>

    <div class="footer">
      <p>${escapeHtml(invoice.clinic.name)} — ${escapeHtml(invoice.clinic.address)}, ${escapeHtml(invoice.clinic.city)}</p>
      <p>ICE: ${escapeHtml(invoice.clinic.ice)} | IF: ${escapeHtml(invoice.clinic.identifiantFiscal)} | RC: ${escapeHtml(invoice.clinic.rc)}</p>
      <p>Document généré automatiquement — Conforme aux exigences de la DGI</p>
    </div>
  </div>
</body>
</html>`;
}
