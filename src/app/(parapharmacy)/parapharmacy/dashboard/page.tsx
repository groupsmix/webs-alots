"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag, AlertTriangle, Clock, Package,
  ArrowRight, DollarSign,
} from "lucide-react";
import Link from "next/link";
import {
  getCurrentUser,
  fetchParapharmacyProducts,
  fetchParapharmacyCategories,
  getLowStockProducts,
  getOutOfStockProducts,
} from "@/lib/data/client";
import type { ProductView, ParapharmacyCategoryView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

export default function ParapharmacyDashboardPage() {
  const [products, setProducts] = useState<ProductView[]>([]);
  const [categories, setCategories] = useState<ParapharmacyCategoryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      const cId = user?.clinic_id;
      if (!cId) { setLoading(false); return; }
      const [p, c] = await Promise.all([
        fetchParapharmacyProducts(cId),
        fetchParapharmacyCategories(cId),
      ]);
      if (controller.signal.aborted) return;
      setProducts(p);
      setCategories(c);
    }
    load()
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, []);

  if (loading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }

  const activeProducts = products.filter((p) => p.active);
  const lowStock = getLowStockProducts(products);
  const outOfStock = getOutOfStockProducts(products);
  const totalValue = products.reduce((sum, p) => sum + p.price * p.stockQuantity, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Parapharmacy Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of your parapharmacy operations</p>
        </div>
        <Badge variant="outline" className="text-pink-600 border-pink-600">
          <Clock className="h-3 w-3 mr-1" />
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Products</p>
                <p className="text-3xl font-bold">{activeProducts.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-pink-100 dark:bg-pink-900/30 text-pink-600 flex items-center justify-center">
                <ShoppingBag className="h-6 w-6" />
              </div>
            </div>
            <Link href="/parapharmacy/catalog" className="text-sm text-pink-600 hover:underline mt-2 inline-flex items-center">
              View Catalog <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-3xl font-bold text-pink-600">{categories.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center">
                <Package className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low Stock Alerts</p>
                <p className="text-3xl font-bold text-orange-500">{lowStock.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
            <Link href="/parapharmacy/inventory" className="text-sm text-pink-600 hover:underline mt-2 inline-flex items-center">
              Manage Stock <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inventory Value</p>
                <p className="text-3xl font-bold">{totalValue.toLocaleString()} <span className="text-sm font-normal">MAD</span></p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Categories */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-lg mb-4">Product Categories</h2>
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {cat.icon && <span className="text-lg">{cat.icon}</span>}
                    <div>
                      <p className="font-medium text-sm">{cat.name}</p>
                      {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">#{cat.sortOrder}</Badge>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No categories configured</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stock Alerts */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Stock Alerts</h2>
              <Link href="/parapharmacy/inventory" className="text-sm text-pink-600 hover:underline">View All</Link>
            </div>
            <div className="space-y-3">
              {outOfStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/10 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category}</p>
                  </div>
                  <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                </div>
              ))}
              {lowStock.filter((p) => p.stockQuantity > 0).slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/10 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Stock: {p.stockQuantity} / Min: {p.minimumStock}</p>
                  </div>
                  <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">Low Stock</Badge>
                </div>
              ))}
              {outOfStock.length === 0 && lowStock.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">All stock levels healthy</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
