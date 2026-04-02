"use client";

import { UtensilsCrossed, Plus, Search, Grid3X3, MapPin } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
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

interface RestaurantTable {
  id: string;
  name: string;
  capacity: number;
  zone: string | null;
  is_active: boolean;
  sort_order: number;
  qr_code_url?: string | null;
}

export default function TableManagementPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newTable, setNewTable] = useState({
    name: "",
    capacity: 4,
    zone: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const loadTables = useCallback(async () => {
    try {
      const res = await fetch("/api/restaurant-tables");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as RestaurantTable[] | { tables: RestaurantTable[] };
      setTables(Array.isArray(data) ? data : (data.tables ?? []));
    } catch (err) {
      logger.warn("Failed to load tables", { context: "table-management-page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/restaurant-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTable.name,
          capacity: newTable.capacity,
          zone: newTable.zone || undefined,
          is_active: newTable.is_active,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setCreateOpen(false);
      setNewTable({ name: "", capacity: 4, zone: "", is_active: true });
      void loadTables();
    } catch (err) {
      logger.warn("Failed to create table", { context: "table-management-page", error: err });
    } finally {
      setSaving(false);
    }
  };

  const filtered = tables.filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const zones = [...new Set(tables.map((t) => t.zone).filter(Boolean))] as string[];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Table Management" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Grid3X3 className="h-6 w-6" />
            Table Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage restaurant tables, zones, and floor plan
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Table
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Grid3X3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{tables.length}</p>
                <p className="text-xs text-muted-foreground">Total Tables</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{tables.reduce((sum, t) => sum + t.capacity, 0)}</p>
                <p className="text-xs text-muted-foreground">Total Capacity</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{zones.length}</p>
                <p className="text-xs text-muted-foreground">Zones</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tables..." className="pl-9" />
      </div>

      {/* Floor Plan Grid */}
      {zones.length > 0 ? (
        zones.map((zone) => {
          const zoneTables = filtered.filter((t) => t.zone === zone);
          if (zoneTables.length === 0) return null;
          return (
            <div key={zone} className="mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                {zone}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {zoneTables.map((table) => (
                  <TableCard key={table.id} table={table} />
                ))}
              </div>
            </div>
          );
        })
      ) : null}

      {/* Tables without zone */}
      {(() => {
        const noZoneTables = filtered.filter((t) => !t.zone);
        if (noZoneTables.length === 0 && zones.length > 0) return null;
        return (
          <div className="mb-6">
            {zones.length > 0 && (
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Unzoned</h3>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {noZoneTables.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No tables found. Create your first table to get started.
                  </CardContent>
                </Card>
              ) : (
                noZoneTables.map((table) => (
                  <TableCard key={table.id} table={table} />
                ))
              )}
            </div>
          </div>
        );
      })()}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent onClose={() => setCreateOpen(false)}>
          <DialogHeader>
            <DialogTitle>New Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Table Name</Label>
              <Input value={newTable.name} onChange={(e) => setNewTable({ ...newTable, name: e.target.value })} placeholder="e.g., Table 1" />
            </div>
            <div className="space-y-2">
              <Label>Capacity</Label>
              <Input type="number" min={1} value={newTable.capacity} onChange={(e) => setNewTable({ ...newTable, capacity: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Zone (optional)</Label>
              <Input value={newTable.zone} onChange={(e) => setNewTable({ ...newTable, zone: e.target.value })} placeholder="e.g., Terrace, Indoor, VIP" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={newTable.is_active} onCheckedChange={(checked) => setNewTable({ ...newTable, is_active: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !newTable.name}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Create Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TableCard({ table }: { table: RestaurantTable }) {
  return (
    <Card className={!table.is_active ? "opacity-60" : ""}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold">{table.name}</span>
          <Badge variant={table.is_active ? "default" : "secondary"}>
            {table.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Capacity: {table.capacity} seats</p>
          {table.zone && <p>Zone: {table.zone}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
