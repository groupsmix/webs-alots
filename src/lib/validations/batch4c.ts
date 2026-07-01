/**
 * Validation schemas for Batch 4C: Patient & Receptionist features.
 *
 * Covers: one-click check-in, smart phone handler, attestations,
 * family accounts, prescription renewals, wait time estimate, inventory.
 */

import { z } from "zod";
import { isoDate } from "./primitives";

// ── 1. One-Click Check-in ──────────────────────────────────────────────

export const oneClickCheckinSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
});

// ── 2. Smart Phone Handler ─────────────────────────────────────────────

export const phoneHandlerLookupSchema = z.object({
  phone: z.string().min(8).max(30),
});

// ── 3. Attestations ────────────────────────────────────────────────────

export const attestationCreateSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  type: z.enum(["medical_certificate", "sick_leave", "attendance_letter", "custom"]),
  title: z.string().min(1).max(500),
  content: z.record(z.string(), z.unknown()).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  daysCount: z.number().int().min(1).max(365).optional(),
  locale: z.enum(["fr", "ar", "en"]).optional(),
});

export const attestationSignSchema = z.object({
  attestationId: z.string().uuid(),
});

export const attestationListSchema = z.object({
  patientId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  type: z.enum(["medical_certificate", "sick_leave", "attendance_letter", "custom"]).optional(),
  status: z.enum(["draft", "signed", "delivered", "revoked"]).optional(),
});

// ── 4. Family Account ──────────────────────────────────────────────────

export const familyLinkCreateSchema = z.object({
  primaryPatientId: z.string().uuid(),
  linkedPatientId: z.string().uuid(),
  relationship: z.enum(["parent", "child", "spouse", "sibling", "guardian", "other"]),
  canBookAppointments: z.boolean().optional(),
  canViewRecords: z.boolean().optional(),
  sharedBilling: z.boolean().optional(),
});

export const familyLinkDeleteSchema = z.object({
  linkId: z.string().uuid(),
});

export const familyMembersListSchema = z.object({
  patientId: z.string().uuid(),
});

// ── 6. Wait Time Estimate ──────────────────────────────────────────────

export const waitTimeEstimateSchema = z.object({
  doctorId: z.string().uuid(),
});

export const doctorDelayUpdateSchema = z.object({
  doctorId: z.string().uuid(),
  delayMinutes: z.number().int().min(0).max(480),
  reason: z.string().max(500).optional(),
});

// ── 7. Inventory ───────────────────────────────────────────────────────

export const inventoryItemCreateSchema = z.object({
  name: z.string().min(1).max(300),
  category: z.enum(["equipment", "consumable", "medication", "other"]),
  sku: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  unit: z.string().max(50).optional(),
  currentStock: z.number().int().min(0).optional(),
  minimumStock: z.number().int().min(0).optional(),
  maximumStock: z.number().int().min(0).optional(),
  reorderPoint: z.number().int().min(0).optional(),
  reorderQuantity: z.number().int().min(1).optional(),
  unitCostCentimes: z.number().int().min(0).optional(),
  supplierName: z.string().max(300).optional(),
  supplierPhone: z.string().max(30).optional(),
  supplierEmail: z.string().email().max(300).optional(),
  expiryDate: isoDate.optional(),
  expiryAlertDays: z.number().int().min(1).max(365).optional(),
  location: z.string().max(200).optional(),
});

export const inventoryItemUpdateSchema = z.object({
  itemId: z.string().uuid(),
  name: z.string().min(1).max(300).optional(),
  category: z.enum(["equipment", "consumable", "medication", "other"]).optional(),
  sku: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  unit: z.string().max(50).optional(),
  minimumStock: z.number().int().min(0).optional(),
  maximumStock: z.number().int().min(0).optional(),
  reorderPoint: z.number().int().min(0).optional(),
  reorderQuantity: z.number().int().min(1).optional(),
  unitCostCentimes: z.number().int().min(0).optional(),
  supplierName: z.string().max(300).optional(),
  supplierPhone: z.string().max(30).optional(),
  supplierEmail: z.string().email().max(300).optional(),
  expiryDate: isoDate.optional(),
  expiryAlertDays: z.number().int().min(1).max(365).optional(),
  location: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});

export const inventoryTransactionSchema = z.object({
  itemId: z.string().uuid(),
  type: z.enum(["restock", "usage", "adjustment", "expired", "returned"]),
  quantity: z.number().int().min(1),
  reason: z.string().max(500).optional(),
  referenceId: z.string().max(200).optional(),
});

export const inventoryAlertsSchema = z.object({
  category: z.enum(["equipment", "consumable", "medication", "other"]).optional(),
  alertType: z.enum(["low_stock", "expiring", "all"]).optional(),
});
