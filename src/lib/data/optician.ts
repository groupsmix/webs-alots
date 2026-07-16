import { createClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/types/database";
import type { FrameCatalogItem, LensInventoryItem } from "@/lib/types/para-medical";

export async function fetchFrameCatalog(clinicId: string): Promise<FrameCatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("frame_catalog")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("brand", { ascending: true })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to load frame catalog: ${error.message}`);
  }

  const rows = (data ?? []) as Tables<"frame_catalog">[];

  return rows.map((r) => ({
    id: r.id,
    clinic_id: r.clinic_id,
    brand: r.brand,
    model: r.model,
    color: r.color,
    size: r.size,
    material: r.material,
    frame_type: r.frame_type as FrameCatalogItem["frame_type"],
    gender: r.gender as FrameCatalogItem["gender"],
    price: r.price,
    cost_price: r.cost_price,
    stock_quantity: r.stock_quantity,
    photo_url: r.photo_url,
    is_active: r.is_active,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function fetchLensInventory(clinicId: string): Promise<LensInventoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lens_inventory")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("type", { ascending: true })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to load lens inventory: ${error.message}`);
  }

  const rows = (data ?? []) as Tables<"lens_inventory">[];

  return rows.map((r) => ({
    id: r.id,
    clinic_id: r.clinic_id,
    type: r.type as LensInventoryItem["type"],
    material: r.material,
    coating: r.coating,
    power_range: r.power_range,
    stock_quantity: r.stock_quantity,
    min_threshold: r.min_threshold,
    unit_cost: r.unit_cost,
    selling_price: r.selling_price,
    supplier: r.supplier,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}
