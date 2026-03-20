"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Filter, Loader2 } from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import {
  type PublicPharmacyProduct,
  getPublicStockStatus,
  searchPublicProducts,
} from "@/lib/data/public";
import { createClient } from "@/lib/supabase-client";

async function fetchProductsClient(): Promise<PublicPharmacyProduct[]> {
  const clinicId = clinicConfig.clinicId;
  const supabase = createClient();

  const [{ data: products }, { data: stockRows }] = await Promise.all([
    supabase.from("products").select("*").eq("clinic_id", clinicId),
    supabase.from("stock").select("*").eq("clinic_id", clinicId),
  ]);

  if (!products) return [];

  const stockMap = new Map(
    ((stockRows ?? []) as { product_id: string; quantity: number; min_threshold: number; expiry_date: string | null }[])
      .map((s) => [s.product_id, s]),
  );

  return products.map((p: Record<string, unknown>) => {
    const s = stockMap.get(p.id as string);
    return {
      id: p.id as string,
      name: p.name as string,
      genericName: (p.generic_name as string) ?? undefined,
      category: (p.category as string) ?? "medication",
      description: (p.description as string) ?? "",
      price: (p.price as number) ?? 0,
      currency: clinicConfig.currency,
      requiresPrescription: (p.requires_prescription as boolean) ?? false,
      stockQuantity: s?.quantity ?? 0,
      minimumStock: s?.min_threshold ?? 0,
      expiryDate: s?.expiry_date ?? "",
      manufacturer: (p.manufacturer as string) ?? undefined,
      barcode: (p.barcode as string) ?? undefined,
      dosageForm: (p.dosage_form as string) ?? undefined,
      strength: (p.strength as string) ?? undefined,
      active: (p.is_active as boolean) ?? true,
    };
  });
}

const categories = [
  { value: "all", label: "All Products" },
  { value: "medication", label: "Medications" },
  { value: "otc", label: "Over the Counter" },
  { value: "cosmetics", label: "Cosmetics" },
  { value: "baby", label: "Baby Care" },
  { value: "medical-devices", label: "Medical Devices" },
  { value: "supplements", label: "Supplements" },
];

export default function CatalogPage() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [allProducts, setAllProducts] = useState<PublicPharmacyProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProductsClient()
      .then(setAllProducts)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let results: PublicPharmacyProduct[];
    if (query.trim()) {
      results = searchPublicProducts(allProducts, query);
    } else {
      results = allProducts.filter((p) => p.active);
    }
    if (selectedCategory !== "all") {
      results = results.filter((p) => p.category === selectedCategory);
    }
    return results;
  }, [query, selectedCategory, allProducts]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Product Catalog</h1>
      <p className="text-muted-foreground mb-8">
        Browse our full range of medications, health products, and more
      </p>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, brand, or category..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm transition-colors ${
                selectedCategory === cat.value
                  ? "bg-emerald-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.value === "all" && <Filter className="mr-1 h-3 w-3" />}
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        Showing {filtered.length} product{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Product Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((product) => {
          const stock = getPublicStockStatus(product);
          return (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <Badge
                    variant={product.requiresPrescription ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {product.requiresPrescription ? "Rx Required" : "OTC"}
                  </Badge>
                  <Badge variant="outline" className="text-xs capitalize">
                    {product.category.replace("-", " ")}
                  </Badge>
                </div>
                <h3 className="font-semibold mb-1">{product.name}</h3>
                {product.genericName && (
                  <p className="text-xs text-muted-foreground italic mb-1">{product.genericName}</p>
                )}
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {product.description}
                </p>
                {product.dosageForm && (
                  <p className="text-xs text-muted-foreground mb-1">
                    {product.dosageForm} {product.strength ? `- ${product.strength}` : ""}
                  </p>
                )}
                {product.manufacturer && (
                <p className="text-xs text-muted-foreground mb-3">
                  by {product.manufacturer}
                </p>
                )}
                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="text-lg font-bold text-emerald-600">
                    {product.price} {product.currency}
                  </span>
                  <Badge
                    variant={stock === "ok" ? "outline" : stock === "low" ? "secondary" : "destructive"}
                    className={stock === "ok" ? "text-emerald-600 border-emerald-600" : stock === "low" ? "text-yellow-600" : ""}
                  >
                    {stock === "ok" ? "In Stock" : stock === "low" ? "Low Stock" : "Out of Stock"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No products found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
        </div>
      )}
        </>
      )}
    </div>
  );
}
