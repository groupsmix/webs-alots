"use client";

import { useState } from "react";
import { Boxes, Plus, AlertTriangle, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MaterialView {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  unitCost: number | null;
  supplier: string | null;
  expiryDate: string | null;
  lastRestocked: string | null;
}

interface MaterialsInventoryProps {
  materials: MaterialView[];
  editable?: boolean;
  onAdd?: (material: { name: string; category: string; quantity: number; unit: string; minThreshold: number; unitCost: number; supplier: string }) => void;
  onRestock?: (materialId: string, quantity: number) => void;
}

export function MaterialsInventory({ materials, editable = false, onAdd, onRestock }: MaterialsInventoryProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", quantity: "0", unit: "pcs", minThreshold: "5", unitCost: "", supplier: "" });
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState("");

  const handleAdd = () => {
    if (form.name.trim() && form.category.trim() && onAdd) {
      onAdd({
        name: form.name, category: form.category,
        quantity: parseFloat(form.quantity) || 0, unit: form.unit,
        minThreshold: parseFloat(form.minThreshold) || 5,
        unitCost: parseFloat(form.unitCost) || 0, supplier: form.supplier,
      });
      setForm({ name: "", category: "", quantity: "0", unit: "pcs", minThreshold: "5", unitCost: "", supplier: "" });
      setShowForm(false);
    }
  };

  const lowStockItems = materials.filter((m) => m.quantity <= m.minThreshold);
  const categories = Array.from(new Set(materials.map((m) => m.category)));
  const totalValue = materials.reduce((sum, m) => sum + (m.unitCost ? m.quantity * m.unitCost : 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Boxes className="h-5 w-5" />
          Materials Inventory
          <Badge variant="secondary" className="ml-1">{materials.length} items</Badge>
          {lowStockItems.length > 0 && (
            <Badge variant="destructive" className="ml-1">
              <AlertTriangle className="h-3 w-3 mr-0.5" /> {lowStockItems.length} low stock
            </Badge>
          )}
        </h2>
        {editable && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Material
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold">{materials.length}</p>
            <p className="text-xs text-muted-foreground">Total Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold">{categories.length}</p>
            <p className="text-xs text-muted-foreground">Categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold">{totalValue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Value (MAD)</p>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Add Material</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Zirconia Disc" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ceramics" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Supplier</Label>
                <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier name" className="text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Quantity</Label>
                <Input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Unit</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Min Threshold</Label>
                <Input type="number" min="0" value={form.minThreshold} onChange={(e) => setForm({ ...form, minThreshold: e.target.value })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Unit Cost (MAD)</Label>
                <Input type="number" min="0" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} className="text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>Add</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-yellow-800 mb-2 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Low Stock Items
            </p>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map((m) => (
                <Badge key={m.id} variant="warning" className="text-xs">
                  {m.name}: {m.quantity} {m.unit}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Materials Table */}
      {materials.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No materials in inventory.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-medium">Material</th>
                    <th className="text-left p-2 font-medium">Category</th>
                    <th className="text-right p-2 font-medium">Qty</th>
                    <th className="text-right p-2 font-medium">Min</th>
                    <th className="text-right p-2 font-medium">Cost</th>
                    <th className="text-left p-2 font-medium">Supplier</th>
                    <th className="text-left p-2 font-medium">Expiry</th>
                    {editable && <th className="p-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => {
                    const isLow = m.quantity <= m.minThreshold;
                    const isExpired = m.expiryDate && new Date(m.expiryDate) < new Date();
                    return (
                      <tr key={m.id} className={`border-b ${isLow ? "bg-red-50" : ""}`}>
                        <td className="p-2 font-medium">{m.name}</td>
                        <td className="p-2 text-muted-foreground">{m.category}</td>
                        <td className={`p-2 text-right font-medium ${isLow ? "text-red-600" : ""}`}>{m.quantity} {m.unit}</td>
                        <td className="p-2 text-right text-muted-foreground">{m.minThreshold}</td>
                        <td className="p-2 text-right">{m.unitCost ? `${m.unitCost} MAD` : "—"}</td>
                        <td className="p-2 text-muted-foreground">{m.supplier || "—"}</td>
                        <td className="p-2">
                          {m.expiryDate ? (
                            <span className={isExpired ? "text-red-600" : ""}>{m.expiryDate}</span>
                          ) : "—"}
                        </td>
                        {editable && (
                          <td className="p-2">
                            {restockId === m.id ? (
                              <div className="flex items-center gap-1">
                                <Input type="number" min="1" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} className="w-16 h-6 text-xs" placeholder="Qty" />
                                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { onRestock?.(m.id, parseFloat(restockQty) || 0); setRestockId(null); setRestockQty(""); }}>
                                  Add
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setRestockId(m.id)}>Restock</Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
