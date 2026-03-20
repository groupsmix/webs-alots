"use client";

/**
 * Data export utilities — CSV generation and download for clinic data.
 * Supports appointments, patients, invoices, and generic record arrays.
 */

// ---------- Core CSV helpers ----------

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
): string {
  const header = columns.map((c) => escapeCSV(c.label)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escapeCSV(row[c.key])).join(","),
  );
  return [header, ...body].join("\n");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(["\uFEFF" + content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------- Generic export ----------

export function exportToCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
  filename: string,
) {
  const csv = arrayToCSV(rows, columns);
  downloadFile(csv, filename, "text/csv");
}

// ---------- Appointment export ----------

export interface ExportableAppointment {
  id: string;
  patientName: string;
  doctorName: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
  isFirstVisit: boolean;
  hasInsurance: boolean;
  notes?: string;
}

const appointmentColumns: { key: keyof ExportableAppointment; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "patientName", label: "Patient" },
  { key: "doctorName", label: "Doctor" },
  { key: "serviceName", label: "Service" },
  { key: "status", label: "Status" },
  { key: "isFirstVisit", label: "First Visit" },
  { key: "hasInsurance", label: "Insurance" },
  { key: "notes", label: "Notes" },
];

export function exportAppointments(appointments: ExportableAppointment[], filenamePrefix = "appointments") {
  const date = new Date().toISOString().split("T")[0];
  exportToCSV(appointments, appointmentColumns, `${filenamePrefix}-${date}.csv`);
}

// ---------- Patient export ----------

export interface ExportablePatient {
  id: string;
  name: string;
  phone: string;
  email: string;
  age: number;
  gender: string;
  dateOfBirth: string;
  insurance?: string;
  registeredAt: string;
}

const patientColumns: { key: keyof ExportablePatient; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "insurance", label: "Insurance" },
  { key: "registeredAt", label: "Registered At" },
];

export function exportPatients(patients: ExportablePatient[], filenamePrefix = "patients") {
  const date = new Date().toISOString().split("T")[0];
  exportToCSV(patients, patientColumns, `${filenamePrefix}-${date}.csv`);
}

// ---------- Invoice export ----------

export interface ExportableInvoice {
  id: string;
  patientName: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  date: string;
}

const invoiceColumns: { key: keyof ExportableInvoice; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "patientName", label: "Patient" },
  { key: "amount", label: "Amount" },
  { key: "currency", label: "Currency" },
  { key: "method", label: "Payment Method" },
  { key: "status", label: "Status" },
];

export function exportInvoices(invoices: ExportableInvoice[], filenamePrefix = "invoices") {
  const date = new Date().toISOString().split("T")[0];
  exportToCSV(invoices, invoiceColumns, `${filenamePrefix}-${date}.csv`);
}
