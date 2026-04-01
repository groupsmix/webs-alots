"use client";

import {
  UtensilsCrossed, Plus, Edit, Trash2, ChevronDown, ChevronUp,
  Eye, EyeOff,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface Menu {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  menu_items?: MenuItem[];
}

export interface MenuItem {
  id: string;
  menu_id: string;
  clinic_id: string;
  category: string;
  name: string;
  description: string | null;
  price: number;
  photo_url: string | null;
  is_available: boolean;
  allergens: string[] | null;
  is_halal: boolean;
  sort_order: number;
}

interface MenuManagementProps {
  menus: Menu[];
  onAddMenu?: () => void;
  onEditMenu?: (menu: Menu) => void;
  onDeleteMenu?: (menuId: string) => void;
  onToggleMenu?: (menuId: string, active: boolean) => void;
  onAddItem?: (menuId: string) => void;
  onEditItem?: (item: MenuItem) => void;
  onDeleteItem?: (itemId: string) => void;
}

export function MenuManagement({
  menus,
  onAddMenu,
  onEditMenu,
  onDeleteMenu,
  onToggleMenu,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: MenuManagementProps) {
  const [expandedMenu, setExpandedMenu] = useState<string | null>(menus[0]?.id ?? null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Gestion des menus</h2>
          <Badge variant="secondary">{menus.length}</Badge>
        </div>
        <Button size="sm" onClick={onAddMenu}>
          <Plus className="h-4 w-4 mr-1" />
          Nouveau menu
        </Button>
      </div>

      {/* Menu List */}
      {menus.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Aucun menu. Commencez par en creer un.</p>
          </CardContent>
        </Card>
      ) : (
        menus.map((menu) => {
          const isExpanded = expandedMenu === menu.id;
          const items = menu.menu_items ?? [];
          const categories = [...new Set(items.map((i) => i.category))];

          return (
            <Card key={menu.id}>
              <CardHeader
                className="cursor-pointer"
                onClick={() => setExpandedMenu(isExpanded ? null : menu.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UtensilsCrossed className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-sm">{menu.name}</CardTitle>
                      {menu.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{menu.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={menu.is_active ? "default" : "secondary"}>
                      {menu.is_active ? "Actif" : "Inactif"}
                    </Badge>
                    <Badge variant="outline">{items.length} plats</Badge>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent>
                  {/* Menu Actions */}
                  <div className="flex gap-2 mb-4">
                    <Button variant="outline" size="sm" onClick={() => onEditMenu?.(menu)}>
                      <Edit className="h-3.5 w-3.5 mr-1" /> Modifier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onToggleMenu?.(menu.id, !menu.is_active)}
                    >
                      {menu.is_active ? (
                        <><EyeOff className="h-3.5 w-3.5 mr-1" /> Desactiver</>
                      ) : (
                        <><Eye className="h-3.5 w-3.5 mr-1" /> Activer</>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onDeleteMenu?.(menu.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1 text-red-500" /> Supprimer
                    </Button>
                    <div className="flex-1" />
                    <Button size="sm" onClick={() => onAddItem?.(menu.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un plat
                    </Button>
                  </div>

                  {/* Items grouped by category */}
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Aucun plat dans ce menu
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {categories.map((cat) => (
                        <div key={cat}>
                          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                            {cat}
                          </h4>
                          <div className="space-y-2">
                            {items
                              .filter((i) => i.category === cat)
                              .map((item) => (
                                <MenuItemRow
                                  key={item.id}
                                  item={item}
                                  onEdit={onEditItem}
                                  onDelete={onDeleteItem}
                                />
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

function MenuItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: MenuItem;
  onEdit?: (item: MenuItem) => void;
  onDelete?: (itemId: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{item.name}</span>
          {!item.is_available && (
            <Badge variant="secondary" className="text-[10px]">Indisponible</Badge>
          )}
          {item.is_halal && (
            <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">Halal</Badge>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
        )}
        {item.allergens && item.allergens.length > 0 && (
          <div className="flex gap-1 mt-1">
            {item.allergens.map((a) => (
              <Badge key={a} variant="destructive" className="text-[9px] px-1 py-0">{a}</Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 ml-4">
        <span className="text-sm font-bold whitespace-nowrap">{item.price.toFixed(2)} MAD</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit?.(item)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete?.(item.id)}>
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Menu Form ─────────────────────────────────────── */

interface AddMenuFormProps {
  onSubmit: (data: { name: string; description?: string }) => void;
  onCancel: () => void;
}

export function AddMenuForm({ onSubmit, onCancel }: AddMenuFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim() || undefined });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4" />
          Nouveau menu
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">Nom du menu *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Menu du jour" required />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Disponible du lundi au vendredi" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm">Creer</Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>Annuler</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
