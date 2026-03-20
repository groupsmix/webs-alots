/**
 * Extended demo data for the Super Admin panel.
 * Supplements the core demo-data.ts with admin-specific types and data.
 */

import type { Clinic } from "./demo-data";

// ---------- Types ----------

export interface ClinicDetail extends Clinic {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  createdAt: string;
  doctorsCount: number;
  appointmentsThisMonth: number;
  domain?: string;
  lastLoginAt: string;
  features: Record<string, boolean>;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "critical";
  target: "all" | "basic" | "standard" | "premium" | string; // "all", tier name, or clinic id
  targetLabel: string;
  publishedAt: string;
  expiresAt?: string;
  active: boolean;
  createdBy: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  description: string;
  clinicId?: string;
  clinicName?: string;
  timestamp: string;
  actor: string;
  type: "clinic" | "billing" | "feature" | "announcement" | "template" | "auth";
}

export interface BillingRecord {
  id: string;
  clinicId: string;
  clinicName: string;
  plan: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: "paid" | "pending" | "overdue" | "cancelled";
  invoiceDate: string;
  dueDate: string;
  paidDate?: string;
  paymentMethod?: string;
}

export interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  key: string;
  category: "core" | "communication" | "integration" | "advanced";
  availableTiers: string[];
  globalEnabled: boolean;
}

export interface ClinicFeatureOverride {
  clinicId: string;
  featureId: string;
  enabled: boolean;
}

// ---------- Data ----------

export const clinicDetails: ClinicDetail[] = [
  {
    id: "c1", name: "Cabinet Dr. Ahmed Benali", type: "doctor", plan: "premium", city: "Casablanca",
    patientsCount: 342, monthlyRevenue: 68400, status: "active",
    ownerName: "Dr. Ahmed Benali", ownerEmail: "ahmed@clinic.ma", ownerPhone: "+212 6 12 34 56 78",
    createdAt: "2025-01-15", doctorsCount: 3, appointmentsThisMonth: 187,
    domain: "dr-ahmed.ma", lastLoginAt: "2026-03-19T14:30:00Z",
    features: { booking: true, patientPortal: true, whatsapp: true, multiDoctor: true, analytics: true, onlinePayment: true, smsReminders: true, customBranding: true, apiAccess: true, insurance: false },
  },
  {
    id: "c2", name: "Dental Studio Marrakech", type: "dentist", plan: "premium", city: "Marrakech",
    patientsCount: 215, monthlyRevenue: 107500, status: "active",
    ownerName: "Dr. Yasmine Alaoui", ownerEmail: "yasmine@dentalstudio.ma", ownerPhone: "+212 6 23 45 67 89",
    createdAt: "2025-02-01", doctorsCount: 4, appointmentsThisMonth: 234,
    domain: "dentalstudio.ma", lastLoginAt: "2026-03-19T16:00:00Z",
    features: { booking: true, patientPortal: true, whatsapp: true, multiDoctor: true, analytics: true, onlinePayment: true, smsReminders: false, customBranding: true, apiAccess: false, insurance: false },
  },
  {
    id: "c3", name: "Pharmacie Centrale Rabat", type: "pharmacy", plan: "standard", city: "Rabat",
    patientsCount: 890, monthlyRevenue: 45000, status: "active",
    ownerName: "Mohammed Tazi", ownerEmail: "mohammed@pharmacie-centrale.ma", ownerPhone: "+212 6 34 56 78 90",
    createdAt: "2025-03-10", doctorsCount: 0, appointmentsThisMonth: 0,
    lastLoginAt: "2026-03-18T10:00:00Z",
    features: { booking: false, patientPortal: true, whatsapp: true, multiDoctor: false, analytics: true, onlinePayment: false, smsReminders: true, customBranding: false, apiAccess: false, insurance: false },
  },
  {
    id: "c4", name: "Cabinet Dr. Youssef", type: "doctor", plan: "basic", city: "Fes",
    patientsCount: 128, monthlyRevenue: 25600, status: "trial",
    ownerName: "Dr. Youssef El Amrani", ownerEmail: "youssef@cabinet-fes.ma", ownerPhone: "+212 6 45 67 89 01",
    createdAt: "2026-02-15", doctorsCount: 1, appointmentsThisMonth: 56,
    lastLoginAt: "2026-03-19T09:15:00Z",
    features: { booking: true, patientPortal: false, whatsapp: false, multiDoctor: false, analytics: false, onlinePayment: false, smsReminders: false, customBranding: false, apiAccess: false, insurance: false },
  },
  {
    id: "c5", name: "Clinique Dentaire Tanger", type: "dentist", plan: "standard", city: "Tangier",
    patientsCount: 176, monthlyRevenue: 52800, status: "active",
    ownerName: "Dr. Karim Fassi", ownerEmail: "karim@dentaire-tanger.ma", ownerPhone: "+212 6 56 78 90 12",
    createdAt: "2025-06-01", doctorsCount: 2, appointmentsThisMonth: 98,
    lastLoginAt: "2026-03-17T11:45:00Z",
    features: { booking: true, patientPortal: true, whatsapp: true, multiDoctor: false, analytics: true, onlinePayment: false, smsReminders: true, customBranding: false, apiAccess: false, insurance: false },
  },
  {
    id: "c6", name: "Pharmacie Ibn Sina", type: "pharmacy", plan: "basic", city: "Agadir",
    patientsCount: 0, monthlyRevenue: 2500, status: "suspended",
    ownerName: "Rachid Amrani", ownerEmail: "rachid@ibnsina.ma", ownerPhone: "+212 6 67 89 01 23",
    createdAt: "2025-08-20", doctorsCount: 0, appointmentsThisMonth: 0,
    lastLoginAt: "2026-01-05T08:30:00Z",
    features: { booking: false, patientPortal: false, whatsapp: false, multiDoctor: false, analytics: false, onlinePayment: false, smsReminders: false, customBranding: false, apiAccess: false, insurance: false },
  },
  {
    id: "c7", name: "Centre Médical Oujda", type: "doctor", plan: "standard", city: "Oujda",
    patientsCount: 203, monthlyRevenue: 40600, status: "active",
    ownerName: "Dr. Laila Bennani", ownerEmail: "laila@medical-oujda.ma", ownerPhone: "+212 6 78 90 12 34",
    createdAt: "2025-04-12", doctorsCount: 2, appointmentsThisMonth: 112,
    lastLoginAt: "2026-03-19T13:00:00Z",
    features: { booking: true, patientPortal: true, whatsapp: true, multiDoctor: false, analytics: true, onlinePayment: false, smsReminders: false, customBranding: false, apiAccess: false, insurance: false },
  },
  {
    id: "c8", name: "Cabinet Dentaire Meknès", type: "dentist", plan: "premium", city: "Meknès",
    patientsCount: 189, monthlyRevenue: 75600, status: "active",
    ownerName: "Dr. Souad Rami", ownerEmail: "souad@dentaire-meknes.ma", ownerPhone: "+212 6 89 01 23 45",
    createdAt: "2025-05-20", doctorsCount: 3, appointmentsThisMonth: 156,
    domain: "dentaire-meknes.ma", lastLoginAt: "2026-03-19T15:30:00Z",
    features: { booking: true, patientPortal: true, whatsapp: true, multiDoctor: true, analytics: true, onlinePayment: true, smsReminders: true, customBranding: true, apiAccess: true, insurance: false },
  },
];

export const announcements: Announcement[] = [
  {
    id: "ann1", title: "System Maintenance", message: "Scheduled maintenance on March 25th, 2:00 AM - 4:00 AM. All services will be temporarily unavailable.",
    type: "warning", target: "all", targetLabel: "All Clinics", publishedAt: "2026-03-19", active: true, createdBy: "System Admin",
  },
  {
    id: "ann2", title: "New Feature: SMS Reminders", message: "SMS appointment reminders are now available for Standard and Premium clinics. Enable them in your settings.",
    type: "info", target: "standard", targetLabel: "Standard & Premium", publishedAt: "2026-03-15", active: true, createdBy: "Product Team",
  },
  {
    id: "ann3", title: "Billing Update", message: "New pricing plans effective April 1st. Contact support for migration details and early-bird discounts.",
    type: "info", target: "all", targetLabel: "All Clinics", publishedAt: "2026-03-10", active: true, createdBy: "Finance Team",
  },
  {
    id: "ann4", title: "Security Advisory", message: "We've enhanced our encryption protocols. Please update your API integrations to use the latest SDK version.",
    type: "critical", target: "premium", targetLabel: "Premium Only", publishedAt: "2026-03-08", active: true, createdBy: "Security Team",
  },
  {
    id: "ann5", title: "Holiday Schedule", message: "Support hours will be reduced during Ramadan. Emergency support remains available 24/7.",
    type: "info", target: "all", targetLabel: "All Clinics", publishedAt: "2026-03-05", expiresAt: "2026-04-05", active: false, createdBy: "Support Team",
  },
];

export const activityLogs: ActivityLog[] = [
  { id: "log1", action: "Clinic Created", description: "New clinic 'Centre Médical Oujda' registered", clinicId: "c7", clinicName: "Centre Médical Oujda", timestamp: "2026-03-19T16:30:00Z", actor: "System Admin", type: "clinic" },
  { id: "log2", action: "Plan Upgraded", description: "Upgraded from Standard to Premium", clinicId: "c8", clinicName: "Cabinet Dentaire Meknès", timestamp: "2026-03-19T15:45:00Z", actor: "Dr. Souad Rami", type: "billing" },
  { id: "log3", action: "Feature Enabled", description: "WhatsApp Notifications enabled", clinicId: "c5", clinicName: "Clinique Dentaire Tanger", timestamp: "2026-03-19T14:20:00Z", actor: "System Admin", type: "feature" },
  { id: "log4", action: "Announcement Published", description: "System Maintenance notice published", timestamp: "2026-03-19T13:00:00Z", actor: "System Admin", type: "announcement" },
  { id: "log5", action: "Clinic Suspended", description: "Account suspended due to non-payment", clinicId: "c6", clinicName: "Pharmacie Ibn Sina", timestamp: "2026-03-18T10:30:00Z", actor: "System Admin", type: "clinic" },
  { id: "log6", action: "Login As Client", description: "Admin logged in as clinic admin", clinicId: "c1", clinicName: "Cabinet Dr. Ahmed Benali", timestamp: "2026-03-18T09:15:00Z", actor: "System Admin", type: "auth" },
  { id: "log7", action: "Template Updated", description: "Standard Prescription template modified", timestamp: "2026-03-17T16:00:00Z", actor: "System Admin", type: "template" },
  { id: "log8", action: "Payment Received", description: "Monthly subscription payment of 500 MAD", clinicId: "c2", clinicName: "Dental Studio Marrakech", timestamp: "2026-03-17T11:00:00Z", actor: "System", type: "billing" },
  { id: "log9", action: "Feature Disabled", description: "API Access disabled for non-premium clinic", clinicId: "c3", clinicName: "Pharmacie Centrale Rabat", timestamp: "2026-03-16T14:30:00Z", actor: "System Admin", type: "feature" },
  { id: "log10", action: "New Registration", description: "New trial account created", clinicId: "c4", clinicName: "Cabinet Dr. Youssef", timestamp: "2026-03-15T10:00:00Z", actor: "Self-Registration", type: "clinic" },
];

export const billingRecords: BillingRecord[] = [
  { id: "bill1", clinicId: "c1", clinicName: "Cabinet Dr. Ahmed Benali", plan: "premium", amountDue: 500, amountPaid: 500, currency: "MAD", status: "paid", invoiceDate: "2026-03-01", dueDate: "2026-03-15", paidDate: "2026-03-05", paymentMethod: "Card" },
  { id: "bill2", clinicId: "c2", clinicName: "Dental Studio Marrakech", plan: "premium", amountDue: 500, amountPaid: 500, currency: "MAD", status: "paid", invoiceDate: "2026-03-01", dueDate: "2026-03-15", paidDate: "2026-03-10", paymentMethod: "Transfer" },
  { id: "bill3", clinicId: "c3", clinicName: "Pharmacie Centrale Rabat", plan: "standard", amountDue: 300, amountPaid: 300, currency: "MAD", status: "paid", invoiceDate: "2026-03-01", dueDate: "2026-03-15", paidDate: "2026-03-12", paymentMethod: "Card" },
  { id: "bill4", clinicId: "c4", clinicName: "Cabinet Dr. Youssef", plan: "basic", amountDue: 0, amountPaid: 0, currency: "MAD", status: "pending", invoiceDate: "2026-03-01", dueDate: "2026-04-01" },
  { id: "bill5", clinicId: "c5", clinicName: "Clinique Dentaire Tanger", plan: "standard", amountDue: 300, amountPaid: 0, currency: "MAD", status: "overdue", invoiceDate: "2026-02-01", dueDate: "2026-02-15" },
  { id: "bill6", clinicId: "c6", clinicName: "Pharmacie Ibn Sina", plan: "basic", amountDue: 150, amountPaid: 0, currency: "MAD", status: "overdue", invoiceDate: "2026-01-01", dueDate: "2026-01-15" },
  { id: "bill7", clinicId: "c7", clinicName: "Centre Médical Oujda", plan: "standard", amountDue: 300, amountPaid: 300, currency: "MAD", status: "paid", invoiceDate: "2026-03-01", dueDate: "2026-03-15", paidDate: "2026-03-08", paymentMethod: "Card" },
  { id: "bill8", clinicId: "c8", clinicName: "Cabinet Dentaire Meknès", plan: "premium", amountDue: 500, amountPaid: 500, currency: "MAD", status: "paid", invoiceDate: "2026-03-01", dueDate: "2026-03-15", paidDate: "2026-03-07", paymentMethod: "Transfer" },
];

export const featureDefinitions: FeatureDefinition[] = [
  { id: "f1", name: "Online Booking", description: "Allow patients to book appointments online via the clinic website", key: "booking", category: "core", availableTiers: ["basic", "standard", "premium"], globalEnabled: true },
  { id: "f2", name: "WhatsApp Notifications", description: "Send booking confirmations and reminders via WhatsApp Business API", key: "whatsapp", category: "communication", availableTiers: ["standard", "premium"], globalEnabled: true },
  { id: "f3", name: "Patient Portal", description: "Give patients access to their medical records, invoices, and appointment history", key: "patientPortal", category: "core", availableTiers: ["standard", "premium"], globalEnabled: true },
  { id: "f4", name: "Multi-Doctor Support", description: "Support multiple doctors and staff members per clinic with individual schedules", key: "multiDoctor", category: "advanced", availableTiers: ["premium"], globalEnabled: true },
  { id: "f5", name: "Insurance Integration", description: "CNSS/CNOPS automatic claim processing and insurance verification", key: "insurance", category: "integration", availableTiers: ["premium"], globalEnabled: false },
  { id: "f6", name: "SMS Reminders", description: "Send appointment reminders and notifications via SMS", key: "smsReminders", category: "communication", availableTiers: ["standard", "premium"], globalEnabled: true },
  { id: "f7", name: "Custom Branding", description: "Allow clinics to customize their website theme, logo, and colors", key: "customBranding", category: "advanced", availableTiers: ["premium"], globalEnabled: true },
  { id: "f8", name: "API Access", description: "RESTful API access for third-party integrations and data export", key: "apiAccess", category: "integration", availableTiers: ["premium"], globalEnabled: true },
  { id: "f9", name: "Revenue Analytics", description: "Detailed revenue reports, charts, and export capabilities", key: "analytics", category: "core", availableTiers: ["standard", "premium"], globalEnabled: true },
  { id: "f10", name: "Walk-in Management", description: "Track and manage walk-in patients with waiting room queue", key: "walkIn", category: "core", availableTiers: ["basic", "standard", "premium"], globalEnabled: true },
  { id: "f11", name: "Online Payment", description: "Accept online payments via CMI payment gateway", key: "onlinePayment", category: "integration", availableTiers: ["premium"], globalEnabled: true },
  { id: "f12", name: "Document Management", description: "Digital document storage, sharing, and patient file uploads", key: "documents", category: "core", availableTiers: ["standard", "premium"], globalEnabled: true },
  { id: "f13", name: "AI Chatbot", description: "AI-powered assistant chatbot for patients and staff with clinic-aware responses", key: "chatbot", category: "integration", availableTiers: ["premium"], globalEnabled: true },
];

// ---------- Helpers ----------

export function getClinicById(id: string): ClinicDetail | undefined {
  return clinicDetails.find((c) => c.id === id);
}

export function getActiveClinicsCount(): number {
  return clinicDetails.filter((c) => c.status === "active").length;
}

export function getTotalPatientsCount(): number {
  return clinicDetails.reduce((sum, c) => sum + c.patientsCount, 0);
}

export function getTotalMonthlyRevenue(): number {
  return clinicDetails.reduce((sum, c) => sum + c.monthlyRevenue, 0);
}

export function getMRR(): number {
  return billingRecords
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + b.amountDue, 0);
}

export function getOverdueCount(): number {
  return billingRecords.filter((b) => b.status === "overdue").length;
}

export function getPaidCount(): number {
  return billingRecords.filter((b) => b.status === "paid").length;
}

export function getRecentActivity(limit: number = 5): ActivityLog[] {
  return activityLogs.slice(0, limit);
}

export function getActiveAnnouncements(): Announcement[] {
  return announcements.filter((a) => a.active);
}
