/**
 * Bordereau de Soins Generator
 *
 * Generates batch insurance claim forms (bordereaux de soins) for
 * CNSS and CNOPS. A bordereau groups multiple patient claims into
 * a single submission document for the insurance organism.
 *
 * Structure:
 * - One bordereau per insurance type per submission period
 * - Contains multiple patient claim rows
 * - Each row lists the patient, acts performed, amounts, and coverage
 * - Totals at the bottom for the entire batch
 */

import { escapeHtml } from "./escape-html";
import { formatMADFormal } from "./morocco";
import type { InsuranceTariffType } from "./insurance-billing";

// ---- Types ----

export interface BordereauPatientClaim {
  /** Patient full name */
  patientName: string;
  /** Patient CIN (national ID) */
  patientCIN: string;
  /** Insurance affiliation number */
  affiliationNumber: string;
  /** Date of treatment (ISO string) */
  dateOfTreatment: string;
  /** List of acts performed */
  acts: BordereauActEntry[];
  /** Total amount charged by doctor */
  totalCharged: number;
  /** Total tarif de référence */
  totalTarifReference: number;
  /** Total amount reimbursable by insurance */
  totalReimbursement: number;
  /** Dépassement d'honoraires */
  depassement: number;
  /** Invoice number linked to this claim */
  invoiceNumber: string;
}

export interface BordereauActEntry {
  /** Act code (NGAP) */
  code: string;
  /** Act description */
  description: string;
  /** Quantity */
  quantity: number;
  /** Tarif de référence (per unit) */
  tarifReference: number;
  /** Amount charged by doctor (per unit) */
  chargedPrice: number;
  /** Reimbursement rate */
  reimbursementRate: number;
  /** Reimbursement amount (per unit) */
  reimbursementAmount: number;
}

export interface BordereauData {
  /** Insurance type */
  insuranceType: InsuranceTariffType;
  /** Bordereau reference number */
  referenceNumber: string;
  /** Submission period start (ISO date) */
  periodStart: string;
  /** Submission period end (ISO date) */
  periodEnd: string;
  /** Doctor / clinic information */
  provider: {
    name: string;
    address: string;
    city: string;
    phone: string;
    conventionNumber: string;
    cnssNumber?: string;
    ice: string;
  };
  /** List of patient claims */
  claims: BordereauPatientClaim[];
  /** Date of submission */
  submissionDate: string;
}

export interface BordereauTotals {
  /** Total number of claims */
  claimCount: number;
  /** Total number of acts across all claims */
  actCount: number;
  /** Total charged by doctor */
  totalCharged: number;
  /** Total tarif de référence */
  totalTarifReference: number;
  /** Total reimbursable */
  totalReimbursement: number;
  /** Total dépassements */
  totalDepassement: number;
}

// ---- Calculation ----

/**
 * Calculate totals for a bordereau.
 */
export function calculateBordereauTotals(
  claims: BordereauPatientClaim[],
): BordereauTotals {
  let actCount = 0;
  let totalCharged = 0;
  let totalTarifReference = 0;
  let totalReimbursement = 0;
  let totalDepassement = 0;

  for (const claim of claims) {
    actCount += claim.acts.reduce((sum, a) => sum + a.quantity, 0);
    totalCharged += claim.totalCharged;
    totalTarifReference += claim.totalTarifReference;
    totalReimbursement += claim.totalReimbursement;
    totalDepassement += claim.depassement;
  }

  return {
    claimCount: claims.length,
    actCount,
    totalCharged: Math.round(totalCharged * 100) / 100,
    totalTarifReference: Math.round(totalTarifReference * 100) / 100,
    totalReimbursement: Math.round(totalReimbursement * 100) / 100,
    totalDepassement: Math.round(totalDepassement * 100) / 100,
  };
}

// ---- Reference Number ----

/**
 * Generate a bordereau reference number.
 * Format: BRD-{CNSS|CNOPS}-YYYY-MM-NNNN
 */
export function generateBordereauNumber(
  insuranceType: InsuranceTariffType,
  year: number,
  month: number,
  sequence: number,
): string {
  const prefix = insuranceType.toUpperCase();
  const monthStr = month.toString().padStart(2, "0");
  const seqStr = sequence.toString().padStart(4, "0");
  return `BRD-${prefix}-${year}-${monthStr}-${seqStr}`;
}

// ---- HTML Generation ----

/**
 * Generate a print-ready HTML bordereau de soins.
 * This is the batch claim form submitted to CNSS or CNOPS.
 */
export function generateBordereauHTML(data: BordereauData): string {
  const totals = calculateBordereauTotals(data.claims);
  const insuranceLabel =
    data.insuranceType === "cnss"
      ? "Caisse Nationale de Sécurité Sociale (CNSS)"
      : "Caisse Nationale des Organismes de Prévoyance Sociale (CNOPS)";

  return `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bordereau de Soins — ${escapeHtml(data.referenceNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10px; color: #333; padding: 15mm; }
    .bordereau { max-width: 297mm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 3px solid #1e40af; }
    .header-left h1 { font-size: 16px; color: #1e40af; margin-bottom: 4px; }
    .header-left h2 { font-size: 12px; color: #64748b; margin-bottom: 8px; }
    .header-left p { font-size: 9px; line-height: 1.5; color: #666; }
    .header-right { text-align: right; }
    .header-right .ref { font-size: 14px; font-weight: 700; color: #1e40af; }
    .header-right p { font-size: 9px; line-height: 1.5; color: #666; }
    .provider-info { background: #f0f4ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px; margin-bottom: 15px; }
    .provider-info h3 { font-size: 10px; color: #1e40af; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.3px; }
    .provider-info .grid { display: flex; gap: 20px; flex-wrap: wrap; }
    .provider-info .grid div { font-size: 9px; line-height: 1.6; }
    .provider-info .grid div strong { color: #1e3a5f; }
    .summary-bar { display: flex; gap: 12px; margin-bottom: 15px; }
    .summary-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; text-align: center; }
    .summary-card .value { font-size: 16px; font-weight: 700; color: #1e40af; }
    .summary-card .label { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9px; }
    thead th { background: #1e40af; color: white; padding: 6px 8px; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: 0.3px; }
    thead th.right { text-align: right; }
    tbody td { padding: 5px 8px; border-bottom: 1px solid #eee; }
    tbody td.right { text-align: right; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr.claim-header { background: #eff6ff; font-weight: 600; }
    tbody tr.claim-header td { border-top: 1px solid #bfdbfe; padding-top: 8px; }
    .acts-detail { padding-left: 20px; font-size: 8px; color: #64748b; }
    tfoot td { padding: 8px; font-weight: 700; border-top: 2px solid #1e40af; font-size: 10px; }
    tfoot td.right { text-align: right; }
    .footer { margin-top: 20px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 30px; }
    .signatures div { width: 30%; text-align: center; }
    .signatures p { font-size: 9px; color: #666; border-top: 1px dashed #ccc; padding-top: 8px; margin-top: 50px; }
    .legal-notice { margin-top: 20px; padding: 8px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; font-size: 8px; color: #92400e; }
    @media print {
      body { padding: 10mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="bordereau">
    <div class="header">
      <div class="header-left">
        <h1>BORDEREAU DE SOINS</h1>
        <h2>${escapeHtml(insuranceLabel)}</h2>
        <p>Période: du ${escapeHtml(data.periodStart)} au ${escapeHtml(data.periodEnd)}</p>
        <p>Date de soumission: ${escapeHtml(data.submissionDate)}</p>
      </div>
      <div class="header-right">
        <p class="ref">${escapeHtml(data.referenceNumber)}</p>
        <p>${escapeHtml(data.insuranceType.toUpperCase())}</p>
      </div>
    </div>

    <div class="provider-info">
      <h3>Prestataire de soins</h3>
      <div class="grid">
        <div><strong>Nom:</strong> ${escapeHtml(data.provider.name)}</div>
        <div><strong>Adresse:</strong> ${escapeHtml(data.provider.address)}, ${escapeHtml(data.provider.city)}</div>
        <div><strong>Tél:</strong> ${escapeHtml(data.provider.phone)}</div>
        <div><strong>N° Convention:</strong> ${escapeHtml(data.provider.conventionNumber)}</div>
        <div><strong>ICE:</strong> ${escapeHtml(data.provider.ice)}</div>
        ${data.provider.cnssNumber ? `<div><strong>N° CNSS:</strong> ${escapeHtml(data.provider.cnssNumber)}</div>` : ""}
      </div>
    </div>

    <div class="summary-bar">
      <div class="summary-card">
        <div class="value">${totals.claimCount}</div>
        <div class="label">Dossiers patients</div>
      </div>
      <div class="summary-card">
        <div class="value">${totals.actCount}</div>
        <div class="label">Actes médicaux</div>
      </div>
      <div class="summary-card">
        <div class="value">${formatMADFormal(totals.totalCharged)}</div>
        <div class="label">Total facturé</div>
      </div>
      <div class="summary-card">
        <div class="value">${formatMADFormal(totals.totalReimbursement)}</div>
        <div class="label">Total remboursable</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>N°</th>
          <th>Patient</th>
          <th>CIN</th>
          <th>N° Affiliation</th>
          <th>Date soins</th>
          <th>Actes</th>
          <th class="right">Tarif réf.</th>
          <th class="right">Honoraires</th>
          <th class="right">Remboursement</th>
          <th>N° Facture</th>
        </tr>
      </thead>
      <tbody>
        ${data.claims.map((claim, idx) => `
          <tr class="claim-header">
            <td>${idx + 1}</td>
            <td>${escapeHtml(claim.patientName)}</td>
            <td>${escapeHtml(claim.patientCIN)}</td>
            <td>${escapeHtml(claim.affiliationNumber)}</td>
            <td>${escapeHtml(claim.dateOfTreatment)}</td>
            <td>${claim.acts.length} acte${claim.acts.length > 1 ? "s" : ""}</td>
            <td class="right">${formatMADFormal(claim.totalTarifReference)}</td>
            <td class="right">${formatMADFormal(claim.totalCharged)}</td>
            <td class="right">${formatMADFormal(claim.totalReimbursement)}</td>
            <td>${escapeHtml(claim.invoiceNumber)}</td>
          </tr>
          ${claim.acts.map((act) => `
          <tr>
            <td></td>
            <td colspan="4" class="acts-detail">${escapeHtml(act.code)} — ${escapeHtml(act.description)} (x${act.quantity})</td>
            <td class="acts-detail">${(act.reimbursementRate * 100).toFixed(0)}%</td>
            <td class="right acts-detail">${formatMADFormal(act.tarifReference * act.quantity)}</td>
            <td class="right acts-detail">${formatMADFormal(act.chargedPrice * act.quantity)}</td>
            <td class="right acts-detail">${formatMADFormal(act.reimbursementAmount * act.quantity)}</td>
            <td></td>
          </tr>`).join("")}
        `).join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="6">TOTAUX (${totals.claimCount} dossier${totals.claimCount > 1 ? "s" : ""})</td>
          <td class="right">${formatMADFormal(totals.totalTarifReference)}</td>
          <td class="right">${formatMADFormal(totals.totalCharged)}</td>
          <td class="right">${formatMADFormal(totals.totalReimbursement)}</td>
          <td></td>
        </tr>
        ${totals.totalDepassement > 0 ? `
        <tr>
          <td colspan="6" style="color: #b45309;">Dont dépassements d'honoraires</td>
          <td colspan="3" class="right" style="color: #b45309;">${formatMADFormal(totals.totalDepassement)}</td>
          <td></td>
        </tr>` : ""}
      </tfoot>
    </table>

    <div class="signatures">
      <div>
        <p>Cachet et signature du prestataire</p>
      </div>
      <div>
        <p>Visa du contrôleur</p>
      </div>
      <div>
        <p>Cachet de l'organisme</p>
      </div>
    </div>

    <div class="legal-notice">
      <strong>Mentions légales:</strong> Ce bordereau est établi conformément à la réglementation
      de l'Assurance Maladie Obligatoire (AMO). Toute fausse déclaration est passible de
      poursuites judiciaires. Les actes nécessitant une entente préalable doivent être
      accompagnés de l'accord de prise en charge.
    </div>
  </div>
</body>
</html>`;
}
