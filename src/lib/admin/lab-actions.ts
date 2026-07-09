"use server";

import type { Json, LabInvoiceStatus, TablesInsert, TablesUpdate } from "@/lib/types/database";
import { adminContext } from "./base";

export interface CreateClinicLabMaterialInput {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  unitCost?: number;
  supplier?: string;
}

export async function createClinicLabMaterial(input: CreateClinicLabMaterialInput) {
  const { clinicId, supabase } = await adminContext();
  const { data, error } = await supabase
    .from("lab_materials")
    .insert({
      clinic_id: clinicId,
      name: input.name.trim(),
      category: input.category.trim(),
      quantity: input.quantity,
      unit: input.unit.trim() || "pcs",
      min_threshold: input.minThreshold,
      unit_cost: input.unitCost ?? null,
      supplier: input.supplier?.trim() || null,
      last_restocked: new Date().toISOString(),
    } as TablesInsert<"lab_materials">)
    .select()
    .single();

  if (error) throw new Error(`Failed to create lab material: ${error.message}`);
  return data;
}

export async function restockClinicLabMaterial(
  materialId: string,
  quantity: number,
): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const { data: current, error: fetchError } = await supabase
    .from("lab_materials")
    .select("quantity")
    .eq("id", materialId)
    .eq("clinic_id", clinicId)
    .single();

  if (fetchError) throw new Error(`Failed to load lab material: ${fetchError.message}`);

  const { error } = await supabase
    .from("lab_materials")
    .update({
      quantity: (current?.quantity ?? 0) + quantity,
      last_restocked: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as TablesUpdate<"lab_materials">)
    .eq("id", materialId)
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to restock lab material: ${error.message}`);
}

export interface CreateClinicLabInvoiceInput {
  invoiceNumber: string;
  dentistName?: string;
  dueDate?: string;
  notes?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
}

export async function createClinicLabInvoice(input: CreateClinicLabInvoiceInput) {
  const { clinicId, supabase } = await adminContext();
  const subtotal = input.items.reduce((sum, item) => sum + item.total, 0);
  const { data, error } = await supabase
    .from("lab_invoices")
    .insert({
      clinic_id: clinicId,
      invoice_number: input.invoiceNumber.trim(),
      dentist_name: input.dentistName?.trim() || null,
      due_date: input.dueDate || null,
      notes: input.notes?.trim() || null,
      items: input.items as Json,
      subtotal,
      tax_amount: 0,
      total: subtotal,
      currency: "MAD",
      status: "draft",
      issued_date: new Date().toISOString().split("T")[0],
    } as TablesInsert<"lab_invoices">)
    .select()
    .single();

  if (error) throw new Error(`Failed to create lab invoice: ${error.message}`);
  return data;
}

export async function updateClinicLabInvoiceStatus(
  invoiceId: string,
  status: LabInvoiceStatus,
): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const { error } = await supabase
    .from("lab_invoices")
    .update({
      status,
      paid_date: status === "paid" ? new Date().toISOString().split("T")[0] : null,
      updated_at: new Date().toISOString(),
    } as TablesUpdate<"lab_invoices">)
    .eq("id", invoiceId)
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to update lab invoice status: ${error.message}`);
}
