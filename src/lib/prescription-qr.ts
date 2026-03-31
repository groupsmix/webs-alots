"use client";

/**
 * Prescription QR Code Generator
 *
 * Generates structured QR code data for electronic prescriptions.
 * The QR code contains a JSON payload that pharmacists can scan
 * to verify and dispense prescriptions.
 *
 * Uses the existing 'qrcode' library (already a project dependency).
 */

import QRCodeLib from "qrcode";

// ---- Types ----

export interface PrescriptionQRMedication {
  /** DCI (generic) name */
  dci: string;
  /** Dosage (e.g., "500mg") */
  dosage: string;
  /** Frequency (e.g., "3x/jour") */
  frequency: string;
  /** Duration (e.g., "7 jours") */
  duration: string;
  /** Special instructions */
  instructions?: string;
}

export interface PrescriptionQRData {
  /** Schema version for forward compatibility */
  v: 1;
  /** Unique prescription number (RX-YYYY-XXXXXX) */
  rx: string;
  /** Doctor INPE number */
  inpe: string;
  /** Doctor name */
  dr: string;
  /** Patient name */
  pt: string;
  /** Patient date of birth (YYYY-MM-DD) */
  dob?: string;
  /** Prescription date (YYYY-MM-DD) */
  date: string;
  /** Clinic name */
  clinic: string;
  /** Medications list */
  meds: PrescriptionQRMedication[];
  /** Diagnosis (abbreviated) */
  dx?: string;
}

// ---- QR Generation ----

/**
 * Build the structured QR data object for a prescription.
 */
export function buildPrescriptionQRData(params: {
  prescriptionNumber: string;
  doctorINPE: string;
  doctorName: string;
  patientName: string;
  patientDOB?: string;
  date: string;
  clinicName: string;
  diagnosis?: string;
  medications: PrescriptionQRMedication[];
}): PrescriptionQRData {
  return {
    v: 1,
    rx: params.prescriptionNumber,
    inpe: params.doctorINPE,
    dr: params.doctorName,
    pt: params.patientName,
    dob: params.patientDOB || undefined,
    date: params.date,
    clinic: params.clinicName,
    meds: params.medications.map((m) => ({
      dci: m.dci,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
      instructions: m.instructions || undefined,
    })),
    dx: params.diagnosis || undefined,
  };
}

/**
 * Generate a QR code as a data URL (base64 PNG) from prescription data.
 * Returns a Promise that resolves to a data:image/png;base64,... string.
 */
export async function generatePrescriptionQRDataURL(
  data: PrescriptionQRData,
  size = 200,
): Promise<string> {
  const json = JSON.stringify(data);
  return QRCodeLib.toDataURL(json, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

/**
 * Generate a QR code as an SVG string from prescription data.
 */
export function generatePrescriptionQRSvg(
  data: PrescriptionQRData,
  size = 200,
): string {
  const json = JSON.stringify(data);
  let svg = "";
  QRCodeLib.toString(
    json,
    {
      type: "svg",
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    },
    (err: Error | null | undefined, svgStr: string) => {
      if (!err) svg = svgStr;
    },
  );
  return svg;
}
