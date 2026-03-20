"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Package, ChevronDown } from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import { fetchEquipmentInventory } from "@/lib/data/client";
import type { EquipmentItemView } from "@/lib/data/client";

const conditionColors: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-700 border-0",
  good: "bg-blue-100 text-blue-700 border-0",
  fair: "bg-yellow-100 text-yellow-700 border-0",
  needs_repair: "bg-orange-100 text-orange-700 border-0",
  decommissioned: "bg-gray-100 text-gray-700 border-0",
};

export default function EquipmentInventoryPage() {
  const [items, setItems] = useState<EquipmentItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchEquipmentInventory(clinicConfig.clinicId)
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading inventory...</div>
      </div>
    );
  }

  const filtered = items.filter((item) => {
    if (conditionFilter !== "all" && item.condition !== conditionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.serialNumber?.toLowerCase().includes(q) ?? false) ||
        item.category.toLowerCase().includes(q) ||
        (item.manufacturer?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Equipment Inventory</h1>
          <p className="text-muted-foreground text-sm">{items.length} items tracked</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, serial number, category..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "new", "good", "fair", "needs_repair", "decommissioned"].map((c) => (
            <Button key={c} variant={conditionFilter === c ? "default" : "outline"} size="sm" onClick={() => setConditionFilter(c)} className="capitalize">
              {c === "all" ? "All" : c.replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((item) => (
          <Card key={item.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Package className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.category} {item.serialNumber ? `· S/N: ${item.serialNumber}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={conditionColors[item.condition] ?? "bg-gray-100 text-gray-700 border-0"}>
                    {item.condition.replace("_", " ")}
                  </Badge>
                  <Badge variant={item.isAvailable ? "outline" : "secondary"} className="text-xs">
                    {item.isAvailable ? "Available" : "In Use"}
                  </Badge>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === item.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {expandedId === item.id && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Model</p>
                      <p className="font-medium">{item.model ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Manufacturer</p>
                      <p className="font-medium">{item.manufacturer ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Purchase Date</p>
                      <p className="font-medium">{item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Purchase Price</p>
                      <p className="font-medium">{item.purchasePrice != null ? `${item.purchasePrice.toLocaleString()} ${item.currency}` : "—"}</p>
                    </div>
                  </div>
                  {item.isRentable && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-muted-foreground text-xs mb-2">Rental Pricing</p>
                      <div className="flex gap-4 text-sm">
                        {item.rentalPriceDaily != null && <span>Daily: {item.rentalPriceDaily} {item.currency}</span>}
                        {item.rentalPriceWeekly != null && <span>Weekly: {item.rentalPriceWeekly} {item.currency}</span>}
                        {item.rentalPriceMonthly != null && <span>Monthly: {item.rentalPriceMonthly} {item.currency}</span>}
                      </div>
                    </div>
                  )}
                  {item.notes && (
                    <div className="mt-3 text-sm">
                      <p className="text-muted-foreground text-xs">Notes</p>
                      <p>{item.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No equipment matches your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
