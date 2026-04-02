"use client";

/**
 * Menu Manager (Restaurant Vertical)
 *
 * Admin component for managing restaurant menus and menu items.
 * Provides CRUD operations for menus and their items with
 * category grouping, availability toggles, and allergen tracking.
 */

import {
  UtensilsCrossed,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  Leaf,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Menu, MenuItem } from "@/lib/types/database";

// ── Types ──

interface MenuWithItems extends Menu {
  items?: MenuItem[];
}

interface MenuManagerProps {
  /** Called when the user wants to create/edit a menu */
  onEditMenu?: (menu?: Menu) => void;
  /** Called when the user wants to create/edit a menu item */
  onEditItem?: (menuId: string, item?: MenuItem) => void;
}

// ── Component ──

export function MenuManager({ onEditMenu, onEditItem }: MenuManagerProps) {
  const [menus, setMenus] = useState<MenuWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  const fetchMenus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/menus");
      const json = (await res.json()) as {
        ok: boolean;
        data?: { menus: Menu[] };
        error?: string;
      };

      if (!json.ok || !json.data) {
        setError(json.error ?? "Erreur lors du chargement des menus.");
        return;
      }

      // Fetch items for each menu
      const menusWithItems: MenuWithItems[] = await Promise.all(
        json.data.menus.map(async (menu) => {
          const itemsRes = await fetch(`/api/menus?menu_id=${menu.id}&items=true`);
          const itemsJson = (await itemsRes.json()) as {
            ok: boolean;
            data?: { menu: Menu; items: MenuItem[] };
          };
          return {
            ...menu,
            items: itemsJson.ok ? itemsJson.data?.items ?? [] : [],
          };
        }),
      );

      setMenus(menusWithItems);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMenus();
  }, [fetchMenus]);

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  };

  const handleDeleteMenu = async (menuId: string) => {
    const res = await fetch(`/api/menus?id=${menuId}&type=menu`, { method: "DELETE" });
    const json = (await res.json()) as { ok: boolean };
    if (json.ok) {
      setMenus((prev) => prev.filter((m) => m.id !== menuId));
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const res = await fetch(`/api/menus?id=${itemId}&type=item`, { method: "DELETE" });
    const json = (await res.json()) as { ok: boolean };
    if (json.ok) {
      setMenus((prev) =>
        prev.map((m) => ({
          ...m,
          items: m.items?.filter((i) => i.id !== itemId),
        })),
      );
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    const res = await fetch("/api/menus", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "item",
        id: item.id,
        is_available: !item.is_available,
      }),
    });
    const json = (await res.json()) as { ok: boolean };
    if (json.ok) {
      setMenus((prev) =>
        prev.map((m) => ({
          ...m,
          items: m.items?.map((i) =>
            i.id === item.id ? { ...i, is_available: !i.is_available } : i,
          ),
        })),
      );
    }
  };

  // Group items by category
  const groupByCategory = (items: MenuItem[]): Record<string, MenuItem[]> => {
    const groups: Record<string, MenuItem[]> = {};
    for (const item of items) {
      const cat = item.category || "Autre";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchMenus()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5" />
          Gestion des menus
        </h2>
        {onEditMenu && (
          <Button size="sm" onClick={() => onEditMenu()}>
            <Plus className="h-4 w-4 mr-1" />
            Nouveau menu
          </Button>
        )}
      </div>

      {menus.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <UtensilsCrossed className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Aucun menu créé. Commencez par ajouter un menu.</p>
          </CardContent>
        </Card>
      )}

      {menus.map((menu) => {
        const isExpanded = expandedMenus.has(menu.id);
        const categories = groupByCategory(menu.items ?? []);

        return (
          <Card key={menu.id} className="border-orange-200 dark:border-orange-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>{menu.name}</span>
                  {!menu.is_active && (
                    <Badge variant="secondary" className="text-[10px]">
                      Inactif
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {menu.items?.length ?? 0} plats
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-1">
                  {onEditMenu && (
                    <Button variant="ghost" size="sm" onClick={() => onEditMenu(menu)} className="h-7 w-7 p-0">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteMenu(menu.id)}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleMenu(menu.id)} className="h-7 w-7 p-0">
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              {menu.description && (
                <p className="text-sm text-muted-foreground mt-1">{menu.description}</p>
              )}
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                {onEditItem && (
                  <Button variant="outline" size="sm" className="mb-3" onClick={() => onEditItem(menu.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Ajouter un plat
                  </Button>
                )}

                {Object.entries(categories).map(([category, items]) => (
                  <div key={category} className="mb-4 last:mb-0">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      {category}
                    </h4>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between rounded-lg border p-3 ${
                            item.is_available
                              ? "bg-background"
                              : "bg-muted/50 opacity-60"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{item.name}</span>
                              {item.is_halal && (
                                <Leaf className="h-3 w-3 text-green-600" aria-label="Halal" />
                              )}
                              {!item.is_available && (
                                <Badge variant="secondary" className="text-[9px]">
                                  Indisponible
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {item.description}
                              </p>
                            )}
                            {item.allergens.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {item.allergens.map((a) => (
                                  <Badge key={a} variant="outline" className="text-[9px] text-amber-600">
                                    {a}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            <span className="text-sm font-semibold whitespace-nowrap">
                              {item.price.toFixed(2)} MAD
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleAvailability(item)}
                              className="h-7 px-2 text-xs"
                            >
                              {item.is_available ? "Masquer" : "Afficher"}
                            </Button>
                            {onEditItem && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEditItem(menu.id, item)}
                                className="h-7 w-7 p-0"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(item.id)}
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {(menu.items?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun plat dans ce menu.
                  </p>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
