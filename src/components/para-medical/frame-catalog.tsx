"use client";

import { useState } from "react";
import {
  Glasses, Search, AlertTriangle, Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { FrameCatalogItem } from "@/lib/types/para-medical";

const FRAME_TYPE_LABELS: Record<string, string> = {
  full_rim: "Full Rim",
  semi_rimless: "Semi Rimless",
  rimless: "Rimless",
};

const GENDER_LABELS: Record<string, string> = {
  men: "Men",
  women: "Women",
  unisex: "Unisex",
  kids: "Kids",
};

interface FrameCatalogProps {
  frames: FrameCatalogItem[];
}

export function FrameCatalog({ frames }: FrameCatalogProps) {
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const filtered = frames.filter((f) => {
    if (search) {
      const q = search.toLowerCase();
      if (!f.brand.toLowerCase().includes(q) && !f.model.toLowerCase().includes(q) && !f.color.toLowerCase().includes(q)) return false;
    }
    if (genderFilter && f.gender !== genderFilter) return false;
    if (typeFilter && f.frame_type !== typeFilter) return false;
    return true;
  });

  const totalStock = frames.reduce((s, f) => s + f.stock_quantity, 0);
  const outOfStock = frames.filter((f) => f.stock_quantity === 0).length;
  const brands = Array.from(new Set(frames.map((f) => f.brand)));

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{frames.length}</p>
            <p className="text-xs text-muted-foreground">Models</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{brands.length}</p>
            <p className="text-xs text-muted-foreground">Brands</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{totalStock}</p>
            <p className="text-xs text-muted-foreground">Total Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{outOfStock}</p>
            <p className="text-xs text-muted-foreground">Out of Stock</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search brand, model, color..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${!genderFilter ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`} onClick={() => setGenderFilter(null)}>All</button>
          {(["men", "women", "unisex", "kids"] as const).map((g) => (
            <button key={g} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${genderFilter === g ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`} onClick={() => setGenderFilter(g)}>
              {GENDER_LABELS[g]}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["full_rim", "semi_rimless", "rimless"] as const).map((t) => (
            <button key={t} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${typeFilter === t ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`} onClick={() => setTypeFilter(typeFilter === t ? null : t)}>
              {FRAME_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Frame grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8 col-span-full">No frames found.</p>
        )}
        {filtered.map((frame) => (
          <Card key={frame.id} className={!frame.is_active ? "opacity-60" : ""}>
            <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
              {frame.photo_url ? (
                <img src={frame.photo_url} alt={`${frame.brand} ${frame.model}`} className="w-full h-full object-cover" />
              ) : (
                <Glasses className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">{frame.brand}</p>
                <Badge variant="outline" className="text-[10px]">{GENDER_LABELS[frame.gender]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{frame.model} — {frame.color}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{frame.material}</span>
                <span>&middot;</span>
                <span>{FRAME_TYPE_LABELS[frame.frame_type]}</span>
                <span>&middot;</span>
                <span>Size: {frame.size}</span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t">
                <p className="text-sm font-bold">{frame.price} MAD</p>
                <div className="flex items-center gap-1">
                  {frame.stock_quantity === 0 ? (
                    <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>
                  ) : frame.stock_quantity <= 3 ? (
                    <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">
                      <AlertTriangle className="h-3 w-3 mr-0.5" /> {frame.stock_quantity} left
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      <Package className="h-3 w-3 mr-0.5" /> {frame.stock_quantity}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
