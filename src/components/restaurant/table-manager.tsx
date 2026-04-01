"use client";

/**
 * Table Manager (Restaurant Vertical)
 *
 * Admin component for managing restaurant tables/seating.
 * Supports zone grouping, capacity display, and QR code generation.
 */

import {
  LayoutGrid,
  Plus,
  Pencil,
  Trash2,
  QrCode,
  RefreshCw,
  AlertTriangle,
  Users,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { RestaurantTable } from "@/lib/types/database";

// ── Props ──

interface TableManagerProps {
  /** Called when the user wants to create/edit a table */
  onEditTable?: (table?: RestaurantTable) => void;
  /** Called when the user wants to generate a QR code for a table */
  onGenerateQr?: (table: RestaurantTable) => void;
}

// ── Component ──

export function TableManager({ onEditTable, onGenerateQr }: TableManagerProps) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTables = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/restaurant-tables");
      const json = (await res.json()) as {
        ok: boolean;
        data?: { tables: RestaurantTable[] };
        error?: string;
      };

      if (!json.ok || !json.data) {
        setError(json.error ?? "Erreur lors du chargement des tables.");
        return;
      }

      setTables(json.data.tables);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTables();
  }, [fetchTables]);

  const handleDelete = async (tableId: string) => {
    const res = await fetch(`/api/restaurant-tables?id=${tableId}`, { method: "DELETE" });
    const json = (await res.json()) as { ok: boolean };
    if (json.ok) {
      setTables((prev) => prev.filter((t) => t.id !== tableId));
    }
  };

  // Group tables by zone
  const groupByZone = (items: RestaurantTable[]): Record<string, RestaurantTable[]> => {
    const groups: Record<string, RestaurantTable[]> = {};
    for (const table of items) {
      const zone = table.zone || "Sans zone";
      if (!groups[zone]) groups[zone] = [];
      groups[zone].push(table);
    }
    return groups;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
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
          <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchTables()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const zones = groupByZone(tables);
  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
  const activeTables = tables.filter((t) => t.is_active).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LayoutGrid className="h-5 w-5" />
          Gestion des tables
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {activeTables}/{tables.length} actives
          </Badge>
          <Badge variant="outline">
            <Users className="h-3 w-3 mr-1" />
            {totalCapacity} places
          </Badge>
          {onEditTable && (
            <Button size="sm" onClick={() => onEditTable()}>
              <Plus className="h-4 w-4 mr-1" />
              Nouvelle table
            </Button>
          )}
        </div>
      </div>

      {tables.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <LayoutGrid className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Aucune table configurée. Commencez par ajouter des tables.</p>
          </CardContent>
        </Card>
      )}

      {Object.entries(zones).map(([zone, zoneTables]) => (
        <Card key={zone}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {zone}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {zoneTables.map((table) => (
                <div
                  key={table.id}
                  className={`relative rounded-lg border p-3 text-center transition-colors ${
                    table.is_active
                      ? "bg-background hover:border-primary/50"
                      : "bg-muted/50 opacity-60"
                  }`}
                >
                  <div className="font-medium text-sm">{table.name}</div>
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1">
                    <Users className="h-3 w-3" />
                    <span>{table.capacity}</span>
                  </div>
                  {!table.is_active && (
                    <Badge variant="secondary" className="text-[9px] mt-1">
                      Inactive
                    </Badge>
                  )}
                  <div className="flex items-center justify-center gap-1 mt-2">
                    {onGenerateQr && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onGenerateQr(table)}
                        className="h-6 w-6 p-0"
                        title="Générer QR code"
                      >
                        <QrCode className="h-3 w-3" />
                      </Button>
                    )}
                    {onEditTable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditTable(table)}
                        className="h-6 w-6 p-0"
                        title="Modifier"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(table.id)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
