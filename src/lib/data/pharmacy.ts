import type { ProductView } from "@/lib/data/client/pharmacy";
import { createClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/types/database";

export async function fetchProducts(clinicId: string): Promise<ProductView[]> {
  const supabase = await createClient();

  const [productsResult, stockResult] = await Promise.all([
    supabase.from("products").select("*").eq("clinic_id", clinicId).limit(1000),
    supabase.from("stock").select("*").eq("clinic_id", clinicId).limit(1000),
  ]);

  if (productsResult.error) {
    throw new Error(`Failed to load products: ${productsResult.error.message}`);
  }
  if (stockResult.error) {
    throw new Error(`Failed to load stock: ${stockResult.error.message}`);
  }

  const stockMap = new Map(
    (stockResult.data ?? []).map((s) => [s.product_id, s as Tables<"stock">]),
  );

  const rows = (productsResult.data ?? []) as Tables<"products">[];

  return rows.map((p) => {
    const s = stockMap.get(p.id);

    return {
      id: p.id,
      name: p.name,
      genericName: p.generic_name ?? undefined,
      category: p.category ?? "General",
      description: p.description ?? undefined,
      price: p.price ?? 0,
      currency: "MAD",
      requiresPrescription: p.requires_prescription ?? false,
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

export function getExpiryStatus(expiryDate: string): "red" | "yellow" | "green" {
  if (!expiryDate) return "green";

  const now = new Date();
  const expiry = new Date(expiryDate);

  if (expiry < now) return "red";

  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 90) return "yellow";

  return "green";
}
