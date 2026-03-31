"use client";

/**
 * Bilingual Prescription PDF Generator (French + Arabic)
 *
 * Generates a print-ready HTML prescription document with a two-column layout:
 * - Left column: French (legal language)
 * - Right column: Arabic (patient-facing, RTL)
 *
 * Uses the same pattern as invoice-generator.ts.
 */

import { escapeHtml } from "@/lib/escape-html";
import {
  translateFrequency,
  translateInstruction,
  translateDuration,
  translateGender,
  getArabicLabel,
} from "@/lib/prescription-arabic";

interface PrescriptionMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface PrescriptionData {
  patientName: string;
  patientAge?: number;
  patientGender?: string;
  diagnosis: string;
  medications: PrescriptionMedication[];
  notes: string;
  doctorName?: string;
  /** Doctor's name in Arabic (optional) */
  doctorNameAr?: string;
  clinicName?: string;
  date: string;
  /** Unique prescription number (RX-YYYY-XXXXXX) */
  prescriptionNumber?: string;
  /** Doctor INPE number */
  doctorINPE?: string;
  /** Base64 data URL of the QR code image */
  qrCodeDataURL?: string;
}

/**
 * Generate print-ready bilingual HTML for a prescription document.
 * French (legal) on left, Arabic (patient) on right.
 */
function generatePrescriptionHTML(data: PrescriptionData): string {
  const medicationRowsFR = data.medications
    .filter((m) => m.name.trim() !== "")
    .map(
      (med, i) => `
      <tr>
        <td class="cell">${i + 1}</td>
        <td class="cell med-name">${escapeHtml(med.name)}</td>
        <td class="cell">${escapeHtml(med.dosage)}</td>
        <td class="cell">${escapeHtml(med.frequency)}</td>
        <td class="cell">${escapeHtml(med.duration)}</td>
        <td class="cell">${escapeHtml(med.instructions) || "-"}</td>
      </tr>`,
    )
    .join("\n");

  const medicationRowsAR = data.medications
    .filter((m) => m.name.trim() !== "")
    .map(
      (med, i) => `
      <tr>
        <td class="cell">${i + 1}</td>
        <td class="cell med-name">${escapeHtml(med.name)}</td>
        <td class="cell">${escapeHtml(med.dosage)}</td>
        <td class="cell">${escapeHtml(translateFrequency(med.frequency))}</td>
        <td class="cell">${escapeHtml(translateDuration(med.duration))}</td>
        <td class="cell">${escapeHtml(translateInstruction(med.instructions)) || "-"}</td>
      </tr>`,
    )
    .join("\n");

  const doctorNameAr = data.doctorNameAr
    ? escapeHtml(data.doctorNameAr)
    : data.doctorName
      ? `\u062F. ${escapeHtml(data.doctorName)}`
      : "";

  const genderFR = data.patientGender
    ? escapeHtml(data.patientGender) === "M" ? "Masculin" : "F\u00E9minin"
    : "";
  const genderAR = data.patientGender
    ? translateGender(data.patientGender)
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ordonnance - ${escapeHtml(data.patientName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #333; padding: 15mm; }
    .prescription { max-width: 210mm; margin: 0 auto; }

    /* Shared header (full width) */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #2563eb; }
    .clinic-info h1 { font-size: 18px; color: #2563eb; margin-bottom: 4px; }
    .clinic-info p { font-size: 10px; color: #666; }
    .rx-symbol { font-size: 36px; color: #2563eb; font-weight: 700; font-style: italic; }
    .rx-number { font-size: 10px; color: #2563eb; font-weight: 600; letter-spacing: 0.5px; }
    .inpe-info { font-size: 9px; color: #666; margin-top: 2px; }

    /* Two-column layout */
    .bilingual { display: flex; gap: 12px; }
    .col-fr { flex: 1; direction: ltr; text-align: left; }
    .col-ar { flex: 1; direction: rtl; text-align: right; font-family: 'Segoe UI', 'Arabic Typesetting', 'Sakkal Majalla', 'Traditional Arabic', Tahoma, sans-serif; }
    .col-divider { width: 1px; background: #d1d5db; flex-shrink: 0; }

    /* Column labels */
    .col-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #2563eb; font-weight: 600; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 1px solid rgba(37,99,235,0.2); }

    /* Patient info */
    .patient-info { background: #f0f4ff; border-radius: 6px; padding: 10px; margin-bottom: 14px; }
    .patient-info h3 { font-size: 9px; text-transform: uppercase; color: #888; margin-bottom: 5px; letter-spacing: 0.5px; }
    .col-ar .patient-info h3 { letter-spacing: 0; }
    .patient-info .row { display: flex; gap: 16px; font-size: 11px; flex-wrap: wrap; }
    .col-ar .patient-info .row { flex-direction: row-reverse; justify-content: flex-end; }
    .patient-info .row span { color: #666; }
    .patient-info .row strong { color: #333; }

    /* Diagnosis */
    .diagnosis { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px; margin-bottom: 14px; }
    .diagnosis h3 { font-size: 9px; text-transform: uppercase; color: #92400e; margin-bottom: 4px; }
    .col-ar .diagnosis h3 { letter-spacing: 0; }
    .diagnosis p { font-size: 11px; }

    /* Medication table */
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    thead th { background: #2563eb; color: white; padding: 6px 6px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; }
    .col-ar thead th { text-align: right; letter-spacing: 0; }
    .cell { padding: 5px 6px; border-bottom: 1px solid #eee; font-size: 10px; }
    .med-name { font-weight: 600; }

    /* Notes */
    .notes { background: #f9fafb; border-radius: 6px; padding: 10px; margin-bottom: 14px; }
    .notes h3 { font-size: 9px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
    .col-ar .notes h3 { letter-spacing: 0; }
    .notes p { font-size: 10px; color: #555; white-space: pre-wrap; }

    /* Signature */
    .signature { margin-top: 20px; }
    .col-fr .signature { text-align: right; }
    .col-ar .signature { text-align: left; }
    .signature .line { border-top: 1px solid #ccc; width: 160px; padding-top: 6px; display: inline-block; }
    .col-fr .signature .line { margin-left: auto; }
    .col-ar .signature .line { margin-right: auto; }
    .signature p { font-size: 10px; color: #666; }

    /* QR section (full width) */
    .qr-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 16px; padding-top: 12px; border-top: 1px dashed #ccc; }
    .qr-code { text-align: center; }
    .qr-code img { width: 100px; height: 100px; }
    .qr-code p { font-size: 8px; color: #999; margin-top: 4px; }

    /* Footer (full width) */
    .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 8px; color: #999; }

    @media print {
      body { padding: 8mm; }
    }
  </style>
</head>
<body>
  <div class="prescription">
    <!-- Shared Header -->
    <div class="header">
      <div class="clinic-info">
        <h1>${escapeHtml(data.clinicName) || "Medical Clinic"}</h1>
        <p>Date: ${escapeHtml(data.date)}</p>
        ${data.doctorName ? `<p>Dr. ${escapeHtml(data.doctorName)}${doctorNameAr ? ` / ${doctorNameAr}` : ""}</p>` : ""}
        ${data.doctorINPE ? `<p class="inpe-info">INPE: ${escapeHtml(data.doctorINPE)}</p>` : ""}
      </div>
      <div style="text-align:right;">
        <div class="rx-symbol">Rx</div>
        ${data.prescriptionNumber ? `<div class="rx-number">${escapeHtml(data.prescriptionNumber)}</div>` : ""}
      </div>
    </div>

    <!-- Two-column bilingual content -->
    <div class="bilingual">
      <!-- French Column (Left - Legal) -->
      <div class="col-fr">
        <div class="col-label">Fran\u00E7ais &mdash; L\u00E9gal</div>

        <div class="patient-info">
          <h3>Informations du patient</h3>
          <div class="row">
            <div><span>Nom: </span><strong>${escapeHtml(data.patientName)}</strong></div>
            ${data.patientAge ? `<div><span>\u00C2ge: </span><strong>${data.patientAge}</strong></div>` : ""}
            ${data.patientGender ? `<div><span>Sexe: </span><strong>${genderFR}</strong></div>` : ""}
          </div>
        </div>

        ${data.diagnosis ? `<div class="diagnosis">
          <h3>Diagnostic</h3>
          <p>${escapeHtml(data.diagnosis)}</p>
        </div>` : ""}

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>M\u00E9dicament</th>
              <th>Posologie</th>
              <th>Fr\u00E9quence</th>
              <th>Dur\u00E9e</th>
              <th>Instructions</th>
            </tr>
          </thead>
          <tbody>
            ${medicationRowsFR}
          </tbody>
        </table>

        ${data.notes ? `<div class="notes">
          <h3>Notes suppl\u00E9mentaires</h3>
          <p>${escapeHtml(data.notes)}</p>
        </div>` : ""}

        <div class="signature">
          <div class="line">
            <p>${data.doctorName ? `Dr. ${escapeHtml(data.doctorName)}` : "Signature du m\u00E9decin"}</p>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div class="col-divider"></div>

      <!-- Arabic Column (Right - Patient) -->
      <div class="col-ar">
        <div class="col-label">\u0627\u0644\u0639\u0631\u0628\u064A\u0629 &mdash; \u0644\u0644\u0645\u0631\u064A\u0636</div>

        <div class="patient-info">
          <h3>${getArabicLabel("Informations du patient")}</h3>
          <div class="row">
            <div><span>${getArabicLabel("Nom")}: </span><strong>${escapeHtml(data.patientName)}</strong></div>
            ${data.patientAge ? `<div><span>${getArabicLabel("\u00C2ge")}: </span><strong>${data.patientAge}</strong></div>` : ""}
            ${data.patientGender ? `<div><span>${getArabicLabel("Sexe")}: </span><strong>${genderAR}</strong></div>` : ""}
          </div>
        </div>

        ${data.diagnosis ? `<div class="diagnosis">
          <h3>${getArabicLabel("Diagnostic")}</h3>
          <p>${escapeHtml(data.diagnosis)}</p>
        </div>` : ""}

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${getArabicLabel("M\u00E9dicament")}</th>
              <th>${getArabicLabel("Posologie")}</th>
              <th>${getArabicLabel("Fr\u00E9quence")}</th>
              <th>${getArabicLabel("Dur\u00E9e")}</th>
              <th>${getArabicLabel("Instructions")}</th>
            </tr>
          </thead>
          <tbody>
            ${medicationRowsAR}
          </tbody>
        </table>

        ${data.notes ? `<div class="notes">
          <h3>${getArabicLabel("Notes suppl\u00E9mentaires")}</h3>
          <p>${escapeHtml(data.notes)}</p>
        </div>` : ""}

        <div class="signature">
          <div class="line">
            <p>${doctorNameAr || getArabicLabel("Physician Signature")}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- QR Code Section (full width) -->
    ${data.qrCodeDataURL ? `<div class="qr-section">
      <div>
        ${data.prescriptionNumber ? `<p class="rx-number">${escapeHtml(data.prescriptionNumber)}</p>` : ""}
        ${data.doctorINPE ? `<p class="inpe-info">INPE: ${escapeHtml(data.doctorINPE)}</p>` : ""}
        <p style="font-size:8px;color:#999;margin-top:8px;">Scannez le QR code pour v\u00E9rifier l'ordonnance / \u0627\u0645\u0633\u062D \u0631\u0645\u0632 QR \u0644\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0648\u0635\u0641\u0629</p>
      </div>
      <div class="qr-code">
        <img src="${data.qrCodeDataURL}" alt="QR Code Ordonnance" />
        <p>Ordonnance \u00E9lectronique / \u0648\u0635\u0641\u0629 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629</p>
      </div>
    </div>` : ""}

    <!-- Footer (full width) -->
    <div class="footer">
      <p>${escapeHtml(data.clinicName) || "Medical Clinic"} &mdash; Prescription g\u00E9n\u00E9r\u00E9e le ${escapeHtml(data.date)} / \u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0648\u0635\u0641\u0629 \u0641\u064A ${escapeHtml(data.date)}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate and download a prescription as a PDF file.
 * Uses an off-screen iframe to render the HTML, then triggers the
 * browser's print-to-PDF flow so the user gets a real downloadable PDF.
 * Falls back to a new-window print dialog when iframe creation fails.
 */
export function downloadPrescriptionPDF(data: PrescriptionData): void {
  const html = generatePrescriptionHTML(data);

  // Try iframe-based approach for a cleaner UX (no popup blocker issues)
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    iframe.onload = () => {
      try {
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn("[prescription-pdf] iframe print failed, using fallback", err);
        fallbackPrint(html);
      }
      // Clean up iframe after a delay to allow print dialog
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
    // Trigger load for already-loaded content
    if (iframeDoc.readyState === "complete") {
      try {
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn("[prescription-pdf] iframe print failed, using fallback", err);
        fallbackPrint(html);
      }
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }
  } else {
    document.body.removeChild(iframe);
    fallbackPrint(html);
  }
}

/**
 * Download the prescription HTML as a standalone .html file that can
 * be opened in any browser and printed to PDF.
 */
export function downloadPrescriptionHTML(data: PrescriptionData): void {
  const html = generatePrescriptionHTML(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `prescription-${data.patientName.replace(/\s+/g, "-").toLowerCase()}-${data.date}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function fallbackPrint(html: string): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to download the prescription PDF.");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}
