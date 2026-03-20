"use client";

/**
 * Prescription PDF Generator
 *
 * Generates a print-ready HTML prescription document and triggers
 * browser print/save-as-PDF. Uses the same pattern as invoice-generator.ts.
 */

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
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;font-weight:600;">${med.name}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;">${med.dosage}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;">${med.frequency}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;">${med.duration}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;">${med.instructions || "-"}</td>
      </tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prescription - ${data.patientName}</title>
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
    @media print {
      body { padding: 10mm; }
    }
  </style>
</head>
<body>
  <div class="prescription">
    <div class="header">
      <div class="clinic-info">
        <h1>${data.clinicName || "Medical Clinic"}</h1>
        <p>Date: ${data.date}</p>
        ${data.doctorName ? `<p>Dr. ${data.doctorName}</p>` : ""}
      </div>
      <div class="rx-symbol">Rx</div>
    </div>

    <div class="patient-info">
      <h3>Patient Information</h3>
      <div class="row">
        <div><span>Name: </span><strong>${data.patientName}</strong></div>
        ${data.patientAge ? `<div><span>Age: </span><strong>${data.patientAge}</strong></div>` : ""}
        ${data.patientGender ? `<div><span>Gender: </span><strong>${data.patientGender === "M" ? "Male" : "Female"}</strong></div>` : ""}
      </div>
    </div>

    ${data.diagnosis ? `<div class="diagnosis">
      <h3>Diagnosis</h3>
      <p>${data.diagnosis}</p>
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
      <p>${data.notes}</p>
    </div>` : ""}

    <div class="signature">
      <div class="line">
        <p>${data.doctorName ? `Dr. ${data.doctorName}` : "Physician Signature"}</p>
      </div>
    </div>

    <div class="footer">
      <p>${data.clinicName || "Medical Clinic"} &mdash; Prescription generated on ${data.date}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate and download a prescription as PDF via browser print dialog.
 * Opens the prescription HTML in a new window and triggers print.
 */
export function downloadPrescriptionPDF(data: PrescriptionData): void {
  const html = generatePrescriptionHTML(data);
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
