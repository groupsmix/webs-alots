"use client";

import { fetchRows } from "./_core";
import { createClient } from "@/lib/supabase-client";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database";
import { getLocalDateStr } from "@/lib/utils";
import type { ProductView, ProductRaw, StockRaw } from "./pharmacy";

// Parapharmacy — Mutations
// ─────────────────────────────────────────────

export async function createParapharmacyProduct(data: {
  clinic_id: string;
  name: string;
  generic_name?: string;
  category?: string;
  description?: string;
  price?: number;
  manufacturer?: string;
  dosage_form?: string;
  strength?: string;
  is_active?: boolean;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from("products")
    .insert({
      clinic_id: data.clinic_id,
      name: data.name,
      generic_name: data.generic_name ?? null,
      category: data.category ?? "General",
      description: data.description ?? null,
      price: data.price ?? 0,
      manufacturer: data.manufacturer ?? null,
      dosage_form: data.dosage_form ?? null,
      strength: data.strength ?? null,
      is_active: data.is_active ?? true,
      is_parapharmacy: true,
      requires_prescription: false,
    })
    .select("id")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return null;
  }
  return result?.id ?? null;
}

export async function updateParapharmacyProduct(
  id: string,
  data: Partial<{
    name: string;
    generic_name: string | null;
    category: string;
    description: string | null;
    price: number;
    manufacturer: string | null;
    dosage_form: string | null;
    strength: string | null;
    is_active: boolean;
  }>,
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ ...data, updated_at: new Date().toISOString() } as Database["public"]["Tables"]["products"]["Update"])
    .eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

export async function deleteParapharmacyProduct(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

export async function createParapharmacySale(data: {
  clinic_id: string;
  patient_name: string;
  payment_method: string;
  items: { product_id: string; product_name: string; quantity: number; unit_price: number }[];
}): Promise<string | null> {
  const supabase = createClient();
  const total = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const now = new Date();
  const { data: result, error } = await supabase.from("sales")
    .insert({
      clinic_id: data.clinic_id,
      patient_name: data.patient_name,
      payment_method: data.payment_method,
      total,
      date: getLocalDateStr(now),
      time: now.toTimeString().slice(0, 5),
      items: data.items,
      is_parapharmacy: true,
    })
    .select("id")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return null;
  }
  // Update stock quantities
  for (const item of data.items) {
    const rpcCall = supabase.rpc as (
      fn: string,
      args: { p_product_id: string; p_quantity: number },
    ) => ReturnType<typeof supabase.rpc>;
    await rpcCall("decrement_stock", {
      p_product_id: item.product_id,
      p_quantity: item.quantity,
    }).then(({ error: rpcErr }: { error: { message: string } | null }) => {
      if (rpcErr) {
        // Fallback: manually update stock
        supabase
          .from("stock")
          .select("quantity")
          .eq("product_id", item.product_id)
          .single()
          .then(({ data: stockRow }) => {
            if (stockRow) {
              const newQty = Math.max(0, (stockRow as { quantity: number }).quantity - item.quantity);
              supabase
                .from("stock")
                .update({ quantity: newQty } as Database["public"]["Tables"]["stock"]["Update"])
                .eq("product_id", item.product_id);
            }
          });
      }
    });
  }
  return result?.id ?? null;
}

export async function adjustParapharmacyStock(
  productId: string,
  newQuantity: number,
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("stock")
    .update({ quantity: newQuantity, updated_at: new Date().toISOString() } as Database["public"]["Tables"]["stock"]["Update"])
    .eq("product_id", productId);
  if (error) {
    // Try insert if no stock row exists
    const { error: insertError } = await supabase.from("stock")
      .insert({ product_id: productId, quantity: newQuantity } as Database["public"]["Tables"]["stock"]["Insert"]);
    if (insertError) {
      void insertError;
      return false;
    }
  }
  return true;
}

// ─────────────────────────────────────────────
// Parapharmacy — Categories
// ─────────────────────────────────────────────

export interface ParapharmacyCategoryView {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  slug: string;
  icon?: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
}

interface ParapharmacyCategoryRaw {
  id: string;
  clinic_id: string;
  name: string;
  name_ar: string | null;
  slug: string;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export async function fetchParapharmacyCategories(clinicId: string): Promise<ParapharmacyCategoryView[]> {
  const rows = await fetchRows<ParapharmacyCategoryRaw>("parapharmacy_categories", {
    eq: [["clinic_id", clinicId]],
    order: ["sort_order", { ascending: true }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameAr: r.name_ar ?? undefined,
    slug: r.slug,
    icon: r.icon ?? undefined,
    parentId: r.parent_id ?? undefined,
    sortOrder: r.sort_order ?? 0,
    isActive: r.is_active ?? true,
  }));
}

// Parapharmacy products reuse the existing Product / stock tables
// with is_parapharmacy=true and requires_prescription=false
export async function fetchParapharmacyProducts(clinicId: string): Promise<ProductView[]> {
  const [products, stock] = await Promise.all([
    fetchRows<ProductRaw>("products", {
      eq: [["clinic_id", clinicId], ["is_parapharmacy", true]],
      order: ["name", { ascending: true }],
    }),
    fetchRows<StockRaw>("stock", { eq: [["clinic_id", clinicId]] }),
  ]);
  const stockMap = new Map(stock.map((s) => [s.product_id, s]));
  return products.map((p) => {
    const s = stockMap.get(p.id);
    return {
      id: p.id,
      name: p.name,
      genericName: p.generic_name ?? undefined,
      category: p.category ?? "General",
      description: p.description ?? undefined,
      price: p.price ?? 0,
      currency: "MAD",
      requiresPrescription: false,
      stockQuantity: s?.quantity ?? 0,
      minimumStock: s?.min_threshold ?? 0,
      expiryDate: s?.expiry_date ?? "",
      barcode: s?.batch_number ?? undefined,
      manufacturer: p.manufacturer ?? undefined,
      supplierId: s?.supplier_id ?? undefined,
      dosageForm: p.dosage_form ?? undefined,
      strength: p.strength ?? undefined,
      active: p.is_active ?? true,
    };
  });
}

// ─────────────────────────────────────────────
