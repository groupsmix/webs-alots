"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tag, Search, Percent, Star, ShoppingBag, ArrowRight,
  Loader2, Sparkles,
} from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";

interface PromotionProduct {
  id: string;
  name: string;
  genericName?: string;
  category: string;
  description: string;
  price: number;
  currency: string;
  requiresPrescription: boolean;
  stockQuantity: number;
  active: boolean;
}

async function fetchFeaturedProducts(): Promise<PromotionProduct[]> {
  const clinicId = clinicConfig.clinicId;
  const supabase = createClient();

  const [{ data: products }, { data: stockRows }] = await Promise.all([
    supabase.from("products").select("*").eq("clinic_id", clinicId).eq("is_active", true),
    supabase.from("stock").select("*").eq("clinic_id", clinicId),
  ]);

  if (!products) return [];

  const stockMap = new Map(
    ((stockRows ?? []) as { product_id: string; quantity: number }[])
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
      active: true,
    };
  });
}

const promoCategories = [
  { value: "all", label: "All", icon: Sparkles },
  { value: "otc", label: "OTC Deals", icon: Tag },
  { value: "cosmetics", label: "Beauty", icon: Star },
  { value: "baby", label: "Baby Care", icon: ShoppingBag },
  { value: "supplements", label: "Supplements", icon: Percent },
];

export default function PromotionsPage() {
  const [products, setProducts] = useState<PromotionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    const controller = new AbortController();
    fetchFeaturedProducts()
      .then((d) => { if (!controller.signal.aborted) setProducts(d); })
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, []);

  const featured = useMemo(() => {
    let results = products.filter((p) => p.stockQuantity > 0);
    if (query.trim()) {
      const q = query.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.genericName?.toLowerCase().includes(q) ?? false) ||
          p.category.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      );
    }
    if (selectedCategory !== "all") {
      results = results.filter((p) => p.category === selectedCategory);
    }
    return results;
  }, [products, query, selectedCategory]);

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <Badge className="bg-emerald-600 text-white mb-4">
          <Sparkles className="h-3 w-3 mr-1" /> Featured & Promotions
        </Badge>
        <h1 className="text-3xl font-bold mb-4">Special Offers</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Discover our featured products, seasonal promotions, and special deals.
          Quality healthcare products at competitive prices.
        </p>
      </div>

      {/* Search */}
      <div className="max-w-xl mx-auto mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search promotions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap justify-center mb-8">
        {promoCategories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm transition-colors ${
              selectedCategory === cat.value
                ? "bg-emerald-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <cat.icon className="mr-1.5 h-3.5 w-3.5" />
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            {featured.length} product{featured.length !== 1 ? "s" : ""} available
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featured.map((product) => (
              <Card key={product.id} className="hover:shadow-md transition-shadow group">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <Badge
                      variant={product.requiresPrescription ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {product.requiresPrescription ? "Prescription" : "OTC"}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">
                      {product.category.replace("-", " ")}
                    </Badge>
                  </div>
                  <h3 className="font-semibold mb-1">{product.name}</h3>
                  {product.genericName && (
                    <p className="text-xs text-muted-foreground italic mb-1">
                      {product.genericName}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t">
                    <span className="text-lg font-bold text-emerald-600">
                      {product.price} {product.currency}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-emerald-600 border-emerald-600"
                    >
                      In Stock
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {featured.length === 0 && (
            <div className="text-center py-16">
              <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No promotions found</h3>
              <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
              <Link
                href="/pharmacy/catalog"
                className="inline-flex items-center text-emerald-600 hover:underline text-sm"
              >
                Browse full catalog <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
