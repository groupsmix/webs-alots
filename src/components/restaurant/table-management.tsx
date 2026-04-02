"use client";

import {
  LayoutGrid, Plus, Edit, Trash2, Users,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface RestaurantTable {
  id: string;
  clinic_id: string;
  name: string;
  capacity: number;
  zone: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface TableManagementProps {
  tables: RestaurantTable[];
  onAdd?: () => void;
  onEdit?: (table: RestaurantTable) => void;
  onDelete?: (tableId: string) => void;
  onToggle?: (tableId: string, active: boolean) => void;
}

export function TableManagement({
  tables,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
}: TableManagementProps) {
  const zones = [...new Set(tables.map((t) => t.zone ?? "Sans zone"))];
  const totalCapacity = tables.filter((t) => t.is_active).reduce((s, t) => s + t.capacity, 0);
  const activeCount = tables.filter((t) => t.is_active).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Gestion des tables</h2>
        </div>
        <Button size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Ajouter une table
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{tables.length}</p>
            <p className="text-xs text-muted-foreground">Total tables</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Tables actives</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{totalCapacity}</p>
            <p className="text-xs text-muted-foreground">Capacite totale</p>
          </CardContent>
        </Card>
      </div>

      {/* Tables by zone */}
      {tables.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Aucune table configuree</p>
          </CardContent>
        </Card>
      ) : (
        zones.map((zone) => (
          <div key={zone}>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">{zone}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tables
                .filter((t) => (t.zone ?? "Sans zone") === zone)
                .map((table) => (
                  <Card
                    key={table.id}
                    className={table.is_active ? "" : "opacity-50"}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{table.name}</span>
                        <Badge variant={table.is_active ? "default" : "secondary"}>
                          {table.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>{table.capacity} places</span>
                      </div>
                      <div className="flex gap-1 mt-3">
                        <Button variant="outline" size="sm" onClick={() => onEdit?.(table)}>
                          <Edit className="h-3 w-3 mr-1" /> Modifier
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onToggle?.(table.id, !table.is_active)}
                        >
                          {table.is_active ? "Desactiver" : "Activer"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onDelete?.(table.id)}>
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ── Add Table Form ────────────────────────────────────── */

interface AddTableFormProps {
  onSubmit: (data: { name: string; capacity: number; zone?: string }) => void;
  onCancel: () => void;
}

export function AddTableForm({ onSubmit, onCancel }: AddTableFormProps) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [zone, setZone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      capacity: parseInt(capacity, 10) || 4,
      zone: zone.trim() || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Nouvelle table
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Table 1" required />
            </div>
            <div>
              <Label className="text-xs">Capacite *</Label>
              <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" min="1" max="100" />
            </div>
            <div>
              <Label className="text-xs">Zone</Label>
              <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Terrasse" />
            </div>
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
