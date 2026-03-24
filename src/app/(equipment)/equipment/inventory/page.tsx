"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, Package, ChevronDown, Plus, Pencil, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import {
  getCurrentUser,
  fetchEquipmentInventory,
  createEquipmentItem,
  updateEquipmentItem,
  deleteEquipmentItem,
} from "@/lib/data/client";
import type { EquipmentItemView } from "@/lib/data/client";
import { useEquipmentLocale } from "../../layout";
import { useEquipmentI18n } from "@/lib/hooks/use-equipment-i18n";
import { PageLoader } from "@/components/ui/page-loader";

const conditionColors: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-700 border-0",
  good: "bg-blue-100 text-blue-700 border-0",
  fair: "bg-yellow-100 text-yellow-700 border-0",
  needs_repair: "bg-orange-100 text-orange-700 border-0",
  decommissioned: "bg-gray-100 text-gray-700 border-0",
};

const CONDITIONS = ["new", "good", "fair", "needs_repair", "decommissioned"] as const;

interface EquipmentFormState {
  name: string;
  category: string;
  serialNumber: string;
  model: string;
  manufacturer: string;
  purchaseDate: string;
  purchasePrice: string;
  condition: string;
  isAvailable: boolean;
  isRentable: boolean;
  rentalPriceDaily: string;
  rentalPriceWeekly: string;
  rentalPriceMonthly: string;
  description: string;
  notes: string;
}

const emptyForm: EquipmentFormState = {
  name: "", category: "", serialNumber: "", model: "", manufacturer: "",
  purchaseDate: "", purchasePrice: "", condition: "new", isAvailable: true,
  isRentable: false, rentalPriceDaily: "", rentalPriceWeekly: "",
  rentalPriceMonthly: "", description: "", notes: "",
};

export default function EquipmentInventoryPage() {
  const { locale } = useEquipmentLocale();
  const { t } = useEquipmentI18n(locale);
  const [items, setItems] = useState<EquipmentItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItemView | null>(null);
  const [form, setForm] = useState<EquipmentFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const dateFmt = locale === "ar" ? "ar-MA" : "fr-FR";

  const conditionLabel = useCallback((c: string) => {
    const map: Record<string, string> = {
      new: t("conditionNew"), good: t("conditionGood"), fair: t("conditionFair"),
      needs_repair: t("conditionNeedsRepair"), decommissioned: t("conditionDecommissioned"),
    };
    return map[c] ?? c;
  }, [t]);

  const [clinicId, setClinicId] = useState<string | null>(null);

  function reload() {
    if (!clinicId) return;
    setLoading(true);
    fetchEquipmentInventory(clinicId)
      .then(setItems)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const controller = new AbortController();
    async function init() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      const cId = user?.clinic_id;
      if (!cId) { setLoading(false); return; }
      setClinicId(cId);
      const data = await fetchEquipmentInventory(cId);
      if (controller.signal.aborted) return;
      setItems(data);
    }
    init()
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, []);

  const openAddDialog = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (item: EquipmentItemView) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category,
      serialNumber: item.serialNumber ?? "",
      model: item.model ?? "",
      manufacturer: item.manufacturer ?? "",
      purchaseDate: item.purchaseDate ?? "",
      purchasePrice: item.purchasePrice != null ? String(item.purchasePrice) : "",
      condition: item.condition,
      isAvailable: item.isAvailable,
      isRentable: item.isRentable,
      rentalPriceDaily: item.rentalPriceDaily != null ? String(item.rentalPriceDaily) : "",
      rentalPriceWeekly: item.rentalPriceWeekly != null ? String(item.rentalPriceWeekly) : "",
      rentalPriceMonthly: item.rentalPriceMonthly != null ? String(item.rentalPriceMonthly) : "",
      description: item.description ?? "",
      notes: item.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.category) return;
    setSaving(true);
    if (editingItem) {
      await updateEquipmentItem(editingItem.id, {
        name: form.name,
        category: form.category,
        serial_number: form.serialNumber || null,
        model: form.model || null,
        manufacturer: form.manufacturer || null,
        purchase_date: form.purchaseDate || null,
        purchase_price: form.purchasePrice ? Number(form.purchasePrice) : null,
        condition: form.condition,
        is_available: form.isAvailable,
        is_rentable: form.isRentable,
        rental_price_daily: form.rentalPriceDaily ? Number(form.rentalPriceDaily) : null,
        rental_price_weekly: form.rentalPriceWeekly ? Number(form.rentalPriceWeekly) : null,
        rental_price_monthly: form.rentalPriceMonthly ? Number(form.rentalPriceMonthly) : null,
        description: form.description || null,
        notes: form.notes || null,
      });
    } else {
      await createEquipmentItem({
        clinic_id: clinicId!,
        name: form.name,
        category: form.category,
        serial_number: form.serialNumber || undefined,
        model: form.model || undefined,
        manufacturer: form.manufacturer || undefined,
        purchase_date: form.purchaseDate || undefined,
        purchase_price: form.purchasePrice ? Number(form.purchasePrice) : undefined,
        condition: form.condition,
        is_available: form.isAvailable,
        is_rentable: form.isRentable,
        rental_price_daily: form.rentalPriceDaily ? Number(form.rentalPriceDaily) : undefined,
        rental_price_weekly: form.rentalPriceWeekly ? Number(form.rentalPriceWeekly) : undefined,
        rental_price_monthly: form.rentalPriceMonthly ? Number(form.rentalPriceMonthly) : undefined,
        description: form.description || undefined,
        notes: form.notes || undefined,
      });
    }
    setSaving(false);
    setDialogOpen(false);
    reload();
  };

  const handleDelete = async (id: string) => {
    await deleteEquipmentItem(id);
    setDeleteConfirm(null);
    reload();
  };

  const updateField = (field: keyof EquipmentFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <PageLoader message="Loading..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
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
          <h1 className="text-2xl font-bold">{t("inventoryTitle")}</h1>
          <p className="text-muted-foreground text-sm">{items.length} {t("itemsTracked")}</p>
        </div>
        <Button onClick={openAddDialog} size="sm" className="bg-amber-600 hover:bg-amber-700">
          <Plus className="h-4 w-4 me-1" /> {t("addEquipment")}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`${t("search")}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", ...CONDITIONS].map((c) => (
            <Button key={c} variant={conditionFilter === c ? "default" : "outline"} size="sm" onClick={() => setConditionFilter(c)}>
              {c === "all" ? t("all") : conditionLabel(c)}
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
                    {conditionLabel(item.condition)}
                  </Badge>
                  <Badge variant={item.isAvailable ? "outline" : "secondary"} className="text-xs">
                    {item.isAvailable ? t("isAvailable") : t("inUse")}
                  </Badge>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === item.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {expandedId === item.id && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">{t("model")}</p>
                      <p className="font-medium">{item.model ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t("manufacturer")}</p>
                      <p className="font-medium">{item.manufacturer ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t("purchaseDate")}</p>
                      <p className="font-medium">{item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString(dateFmt) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t("purchasePrice")}</p>
                      <p className="font-medium">{item.purchasePrice != null ? `${item.purchasePrice.toLocaleString()} ${item.currency}` : "—"}</p>
                    </div>
                  </div>
                  {item.isRentable && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-muted-foreground text-xs mb-2">{t("rentalPricing")}</p>
                      <div className="flex gap-4 text-sm">
                        {item.rentalPriceDaily != null && <span>{t("daily")}: {item.rentalPriceDaily} {item.currency}</span>}
                        {item.rentalPriceWeekly != null && <span>{t("weekly")}: {item.rentalPriceWeekly} {item.currency}</span>}
                        {item.rentalPriceMonthly != null && <span>{t("monthly")}: {item.rentalPriceMonthly} {item.currency}</span>}
                      </div>
                    </div>
                  )}
                  {item.notes && (
                    <div className="mt-3 text-sm">
                      <p className="text-muted-foreground text-xs">{t("notes")}</p>
                      <p>{item.notes}</p>
                    </div>
                  )}
                  <div className="mt-4 pt-3 border-t flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEditDialog(item); }}>
                      <Pencil className="h-3 w-3 me-1" /> {t("edit")}
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item.id); }}>
                      <Trash2 className="h-3 w-3 me-1" /> {t("delete")}
                    </Button>
                    <Link href="/equipment/maintenance" className="ms-auto">
                      <Button variant="ghost" size="sm">
                        <Wrench className="h-3 w-3 me-1" /> {t("maintenanceHistory")}
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t("noEquipmentMatch")}</p>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? t("editEquipment") : t("addEquipment")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("equipmentName")} *</Label>
                <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} />
              </div>
              <div>
                <Label>{t("category")} *</Label>
                <Input value={form.category} onChange={(e) => updateField("category", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("serialNumber")}</Label>
                <Input value={form.serialNumber} onChange={(e) => updateField("serialNumber", e.target.value)} />
              </div>
              <div>
                <Label>{t("model")}</Label>
                <Input value={form.model} onChange={(e) => updateField("model", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("manufacturer")}</Label>
                <Input value={form.manufacturer} onChange={(e) => updateField("manufacturer", e.target.value)} />
              </div>
              <div>
                <Label>{t("condition")}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.condition}
                  onChange={(e) => updateField("condition", e.target.value)}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>{conditionLabel(c)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("purchaseDate")}</Label>
                <Input type="date" value={form.purchaseDate} onChange={(e) => updateField("purchaseDate", e.target.value)} />
              </div>
              <div>
                <Label>{t("purchasePrice")} (MAD)</Label>
                <Input type="number" value={form.purchasePrice} onChange={(e) => updateField("purchasePrice", e.target.value)} />
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isAvailable} onChange={(e) => updateField("isAvailable", e.target.checked)} className="rounded" />
                {t("isAvailable")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isRentable} onChange={(e) => updateField("isRentable", e.target.checked)} className="rounded" />
                {t("isRentable")}
              </label>
            </div>
            {form.isRentable && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>{t("daily")} (MAD)</Label>
                  <Input type="number" value={form.rentalPriceDaily} onChange={(e) => updateField("rentalPriceDaily", e.target.value)} />
                </div>
                <div>
                  <Label>{t("weekly")} (MAD)</Label>
                  <Input type="number" value={form.rentalPriceWeekly} onChange={(e) => updateField("rentalPriceWeekly", e.target.value)} />
                </div>
                <div>
                  <Label>{t("monthly")} (MAD)</Label>
                  <Input type="number" value={form.rentalPriceMonthly} onChange={(e) => updateField("rentalPriceMonthly", e.target.value)} />
                </div>
              </div>
            )}
            <div>
              <Label>{t("description")}</Label>
              <Input value={form.description} onChange={(e) => updateField("description", e.target.value)} />
            </div>
            <div>
              <Label>{t("notes")}</Label>
              <Input value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.category} className="bg-amber-600 hover:bg-amber-700">
              {saving ? t("loading") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent onClose={() => setDeleteConfirm(null)}>
          <DialogHeader>
            <DialogTitle>{t("deleteEquipment")}</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-sm">{t("confirmDeleteEquipment")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
