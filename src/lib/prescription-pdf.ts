"use client";

/**
 * Prescription PDF Generator
 *
 * Generates a print-ready HTML prescription document and triggers
 * browser print/save-as-PDF. Uses the same pattern as invoice-generator.ts.
 */

import { escapeHtml } from "@/lib/escape-html";

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
 * Generate print-ready HTML for a prescription document.
 */
function generatePrescriptionHTML(data: PrescriptionData): string {
  const medicationRows = data.medications
    .filter((m) => m.name.trim() !== "")
    .map(
      (med, i) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;">${i + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;font-weight:600;">${escapeHtml(med.name)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;">${escapeHtml(med.dosage)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;">${escapeHtml(med.frequency)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;">${escapeHtml(med.duration)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;">${escapeHtml(med.instructions) || "-"}</td>
      </tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prescription - ${escapeHtml(data.patientName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #333; padding: 20mm; }
    .prescription { max-width: 210mm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #2563eb; }
    .clinic-info h1 { font-size: 18px; color: #2563eb; margin-bottom: 4px; }
    .clinic-info p { font-size: 11px; color: #666; }
    .rx-symbol { font-size: 36px; color: #2563eb; font-weight: 700; font-style: italic; }
    .patient-info { background: #f0f4ff; border-radius: 6px; padding: 12px; margin-bottom: 20px; }
    .patient-info h3 { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 6px; letter-spacing: 0.5px; }
    .patient-info .row { display: flex; gap: 24px; font-size: 12px; }
    .patient-info .row span { color: #666; }
    .patient-info .row strong { color: #333; }
    .diagnosis { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px; margin-bottom: 20px; }
    .diagnosis h3 { font-size: 10px; text-transform: uppercase; color: #92400e; margin-bottom: 4px; }
    .diagnosis p { font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead th { background: #2563eb; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
    .notes { background: #f9fafb; border-radius: 6px; padding: 12px; margin-bottom: 30px; }
    .notes h3 { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
    .notes p { font-size: 11px; color: #555; white-space: pre-wrap; }
    .signature { margin-top: 40px; text-align: right; }
    .signature .line { border-top: 1px solid #ccc; width: 200px; margin-left: auto; padding-top: 8px; }
    .signature p { font-size: 11px; color: #666; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 9px; color: #999; }
    .qr-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #ccc; }
    .qr-code { text-align: center; }
    .qr-code img { width: 120px; height: 120px; }
    .qr-code p { font-size: 8px; color: #999; margin-top: 4px; }
    .rx-number { font-size: 10px; color: #2563eb; font-weight: 600; letter-spacing: 0.5px; }
    .inpe-info { font-size: 9px; color: #666; margin-top: 2px; }
    @media print {
      body { padding: 10mm; }
    }
  </style>
</head>
<body>
  <div class="prescription">
    <div class="header">
      <div class="clinic-info">
        <h1>${escapeHtml(data.clinicName) || "Medical Clinic"}</h1>
        <p>Date: ${escapeHtml(data.date)}</p>
        ${data.doctorName ? `<p>Dr. ${escapeHtml(data.doctorName)}</p>` : ""}
        ${data.doctorINPE ? `<p class="inpe-info">INPE: ${escapeHtml(data.doctorINPE)}</p>` : ""}
      </div>
      <div style="text-align:right;">
        <div class="rx-symbol">Rx</div>
        ${data.prescriptionNumber ? `<div class="rx-number">${escapeHtml(data.prescriptionNumber)}</div>` : ""}
      </div>
    </div>

    <div class="patient-info">
      <h3>Patient Information</h3>
      <div class="row">
        <div><span>Name: </span><strong>${escapeHtml(data.patientName)}</strong></div>
        ${data.patientAge ? `<div><span>Age: </span><strong>${data.patientAge}</strong></div>` : ""}
        ${data.patientGender ? `<div><span>Gender: </span><strong>${escapeHtml(data.patientGender) === "M" ? "Male" : "Female"}</strong></div>` : ""}
      </div>
    </div>

    ${data.diagnosis ? `<div class="diagnosis">
      <h3>Diagnosis</h3>
      <p>${escapeHtml(data.diagnosis)}</p>
    </div>` : ""}

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Medication</th>
          <th>Dosage</th>
          <th>Frequency</th>
          <th>Duration</th>
          <th>Instructions</th>
        </tr>
      </thead>
      <tbody>
        ${medicationRows}
      </tbody>
    </table>

    ${data.notes ? `<div class="notes">
      <h3>Additional Notes</h3>
      <p>${escapeHtml(data.notes)}</p>
    </div>` : ""}

    ${data.qrCodeDataURL ? `<div class="qr-section">
      <div>
        ${data.prescriptionNumber ? `<p class="rx-number">${escapeHtml(data.prescriptionNumber)}</p>` : ""}
        ${data.doctorINPE ? `<p class="inpe-info">INPE: ${escapeHtml(data.doctorINPE)}</p>` : ""}
        <p style="font-size:8px;color:#999;margin-top:8px;">Scannez le QR code pour vérifier l'ordonnance</p>
      </div>
      <div class="qr-code">
        <img src="${data.qrCodeDataURL}" alt="QR Code Ordonnance" />
        <p>Ordonnance électronique</p>
      </div>
    </div>` : ""}

    <div class="signature">
      <div class="line">
        <p>${data.doctorName ? `Dr. ${escapeHtml(data.doctorName)}` : "Physician Signature"}</p>
      </div>
    </div>

    <div class="footer">
      <p>${escapeHtml(data.clinicName) || "Medical Clinic"} &mdash; Prescription generated on ${escapeHtml(data.date)}</p>
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
