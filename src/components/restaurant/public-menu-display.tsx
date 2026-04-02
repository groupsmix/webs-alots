"use client";

import { UtensilsCrossed, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Menu, MenuItem } from "./menu-management";

interface PublicMenuDisplayProps {
  menus: Menu[];
  restaurantName?: string;
  currency?: string;
}

export function PublicMenuDisplay({
  menus,
  restaurantName,
  currency = "MAD",
}: PublicMenuDisplayProps) {
  const [activeMenuId, setActiveMenuId] = useState(menus[0]?.id ?? "");
  const [search, setSearch] = useState("");

  const activeMenu = menus.find((m) => m.id === activeMenuId);
  const items = activeMenu?.menu_items?.filter((item) =>
    item.is_available &&
    (search === "" ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()))
  ) ?? [];

  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <UtensilsCrossed className="h-10 w-10 mx-auto text-primary mb-2" />
        {restaurantName && (
          <h1 className="text-2xl font-bold mb-1">{restaurantName}</h1>
        )}
        <p className="text-sm text-muted-foreground">Notre carte</p>
      </div>

      {/* Menu Tabs */}
      {menus.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {menus.map((menu) => (
            <button
              key={menu.id}
              onClick={() => setActiveMenuId(menu.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeMenuId === menu.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {menu.name}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un plat..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Menu Items by Category */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">Aucun plat disponible</p>
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map((cat) => (
            <section key={cat}>
              <h2 className="text-lg font-semibold border-b pb-2 mb-4 capitalize">{cat}</h2>
              <div className="space-y-3">
                {items
                  .filter((i) => i.category === cat)
                  .map((item) => (
                    <PublicMenuItem key={item.id} item={item} currency={currency} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function PublicMenuItem({ item, currency }: { item: MenuItem; currency: string }) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">{item.name}</h3>
              {item.is_halal && (
                <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">
                  Halal
                </Badge>
              )}
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
            )}
            {item.allergens && item.allergens.length > 0 && (
              <p className="text-[10px] text-orange-600 mt-1">
                Allergenes: {item.allergens.join(", ")}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <span className="text-sm font-bold">{item.price.toFixed(2)}</span>
            <span className="text-xs text-muted-foreground ml-1">{currency}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
