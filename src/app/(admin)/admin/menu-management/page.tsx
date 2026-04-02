"use client";

import { UtensilsCrossed, Plus, Search } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { MenuManagement, AddMenuForm, type Menu, type MenuItem } from "@/components/restaurant/menu-management";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { logger } from "@/lib/logger";

export default function MenuManagementPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addItemMenuId, setAddItemMenuId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    description: "",
    price: 0,
    is_available: true,
    is_halal: true,
    allergens: "",
  });
  const [saving, setSaving] = useState(false);

  const loadMenus = useCallback(async () => {
    try {
      const res = await fetch("/api/menus");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as Menu[] | { menus: Menu[] };
      const menuList = Array.isArray(data) ? data : (data.menus ?? []);

      // Load items for each menu
      const menusWithItems = await Promise.all(
        menuList.map(async (menu: Menu) => {
          const itemsRes = await fetch(`/api/menu-items?menu_id=${menu.id}`);
          if (!itemsRes.ok) return { ...menu, menu_items: [] };
          const itemsData = (await itemsRes.json()) as { items: MenuItem[] };
          return { ...menu, menu_items: itemsData.items ?? [] };
        }),
      );

      setMenus(menusWithItems);
    } catch (err) {
      logger.warn("Failed to load menus", { context: "menu-management-page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMenus();
  }, [loadMenus]);

  const handleAddMenu = async (data: { name: string; description?: string }) => {
    try {
      const res = await fetch("/api/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create menu");
      setShowAddMenu(false);
      void loadMenus();
    } catch (err) {
      logger.warn("Failed to create menu", { context: "menu-management-page", error: err });
    }
  };

  const handleDeleteMenu = async (menuId: string) => {
    if (!confirm("Are you sure you want to delete this menu?")) return;
    try {
      await fetch(`/api/menus?id=${menuId}`, { method: "DELETE" });
      void loadMenus();
    } catch (err) {
      logger.warn("Failed to delete menu", { context: "menu-management-page", error: err });
    }
  };

  const handleToggleMenu = async (menuId: string, active: boolean) => {
    try {
      await fetch("/api/menus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: menuId, is_active: active }),
      });
      void loadMenus();
    } catch (err) {
      logger.warn("Failed to toggle menu", { context: "menu-management-page", error: err });
    }
  };

  const handleAddItem = async () => {
    if (!addItemMenuId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_id: addItemMenuId,
          name: newItem.name,
          category: newItem.category,
          description: newItem.description || undefined,
          price: newItem.price,
          is_available: newItem.is_available,
          is_halal: newItem.is_halal,
          allergens: newItem.allergens ? newItem.allergens.split(",").map((a) => a.trim()) : [],
        }),
      });
      if (!res.ok) throw new Error("Failed to create item");
      setAddItemMenuId(null);
      setNewItem({ name: "", category: "", description: "", price: 0, is_available: true, is_halal: true, allergens: "" });
      void loadMenus();
    } catch (err) {
      logger.warn("Failed to create menu item", { context: "menu-management-page", error: err });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await fetch(`/api/menu-items?id=${itemId}`, { method: "DELETE" });
      void loadMenus();
    } catch (err) {
      logger.warn("Failed to delete menu item", { context: "menu-management-page", error: err });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Menu Management" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6" />
            Menu Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your restaurant menus and menu items
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{menus.length}</p>
                <p className="text-xs text-muted-foreground">Total Menus</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{menus.reduce((s, m) => s + (m.menu_items?.length ?? 0), 0)}</p>
                <p className="text-xs text-muted-foreground">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{menus.filter((m) => m.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Active Menus</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Menu Form */}
      {showAddMenu && (
        <div className="mb-4">
          <AddMenuForm
            onSubmit={handleAddMenu}
            onCancel={() => setShowAddMenu(false)}
          />
        </div>
      )}

      {/* Menu Management Component */}
      <MenuManagement
        menus={menus}
        onAddMenu={() => setShowAddMenu(true)}
        onDeleteMenu={handleDeleteMenu}
        onToggleMenu={handleToggleMenu}
        onAddItem={(menuId) => setAddItemMenuId(menuId)}
        onDeleteItem={handleDeleteItem}
      />

      {/* Add Item Dialog */}
      <Dialog open={!!addItemMenuId} onOpenChange={(open) => { if (!open) setAddItemMenuId(null); }}>
        <DialogContent onClose={() => setAddItemMenuId(null)}>
          <DialogHeader>
            <DialogTitle>Add Menu Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g., Tajine Poulet" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} placeholder="e.g., Plats principaux" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder="Item description..." />
            </div>
            <div className="space-y-2">
              <Label>Price (MAD)</Label>
              <Input type="number" step="0.01" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Allergens (comma-separated)</Label>
              <Input value={newItem.allergens} onChange={(e) => setNewItem({ ...newItem, allergens: e.target.value })} placeholder="e.g., gluten, dairy" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Available</Label>
              <Switch checked={newItem.is_available} onCheckedChange={(checked) => setNewItem({ ...newItem, is_available: checked })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Halal</Label>
              <Switch checked={newItem.is_halal} onCheckedChange={(checked) => setNewItem({ ...newItem, is_halal: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemMenuId(null)}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={saving || !newItem.name || !newItem.category}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
