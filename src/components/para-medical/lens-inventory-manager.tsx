"use client";

import { useState } from "react";
import {
  Search, AlertTriangle, Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { LensInventoryItem } from "@/lib/types/para-medical";

const TYPE_LABELS: Record<string, string> = {
  single_vision: "Single Vision",
  bifocal: "Bifocal",
  progressive: "Progressive",
  contact: "Contact Lens",
  sunglasses: "Sunglasses",
};

interface LensInventoryManagerProps {
  items: LensInventoryItem[];
}

export function LensInventoryManager({ items }: LensInventoryManagerProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const types = Array.from(new Set(items.map((i) => i.type)));

  const filtered = items.filter((item) => {
    if (search && !item.material.toLowerCase().includes(search.toLowerCase()) && !item.supplier.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter && item.type !== typeFilter) return false;
    return true;
  });

  const lowStock = items.filter((i) => i.stock_quantity <= i.min_threshold);
  const totalValue = items.reduce((s, i) => s + i.stock_quantity * i.unit_cost, 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <p className="text-2xl font-bold">{items.length}</p>
            <p className="text-xs text-muted-foreground">Total Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-orange-600" />
            <p className="text-2xl font-bold text-orange-600">{lowStock.length}</p>
            <p className="text-xs text-muted-foreground">Low Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalValue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Inventory Value (MAD)</p>
          </CardContent>
        </Card>
      </div>

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div className="p-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <p className="text-xs font-medium text-orange-800 dark:text-orange-200 flex items-center gap-1 mb-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Low Stock Alerts
          </p>
          <div className="space-y-1">
            {lowStock.map((item) => (
              <p key={item.id} className="text-xs text-orange-700 dark:text-orange-300">
                {TYPE_LABELS[item.type]} — {item.material}: {item.stock_quantity}/{item.min_threshold} remaining
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Search & filter */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by material or supplier..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${!typeFilter ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`} onClick={() => setTypeFilter(null)}>
            All Types
          </button>
          {types.map((type) => (
            <button key={type} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${typeFilter === type ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`} onClick={() => setTypeFilter(type)}>
              {TYPE_LABELS[type] ?? type}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No items found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2.5 px-3">Type</th>
                    <th className="text-left py-2.5 px-3">Material</th>
                    <th className="text-left py-2.5 px-3">Coating</th>
                    <th className="text-left py-2.5 px-3">Power Range</th>
                    <th className="text-right py-2.5 px-3">Stock</th>
                    <th className="text-right py-2.5 px-3">Cost</th>
                    <th className="text-right py-2.5 px-3">Price</th>
                    <th className="text-left py-2.5 px-3">Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const isLow = item.stock_quantity <= item.min_threshold;
                    return (
                      <tr key={item.id} className={`border-b last:border-0 ${isLow ? "bg-orange-50/50 dark:bg-orange-950/10" : ""}`}>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[item.type]}</Badge>
                        </td>
                        <td className="py-2.5 px-3 font-medium">{item.material}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{item.coating ?? "—"}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{item.power_range}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={isLow ? "text-orange-600 font-medium" : ""}>{item.stock_quantity}</span>
                          {isLow && <AlertTriangle className="h-3 w-3 text-orange-600 inline ml-1" />}
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">{item.unit_cost} MAD</td>
                        <td className="py-2.5 px-3 text-right font-medium">{item.selling_price} MAD</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{item.supplier}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
