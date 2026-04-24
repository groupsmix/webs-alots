"use client";

import { Search, Wrench, ChevronDown, CalendarClock, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/components/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import {
  fetchEquipmentMaintenance, fetchEquipmentInventory,
  createEquipmentMaintenance, updateEquipmentMaintenance, deleteEquipmentMaintenance,
} from "@/lib/data/client";
import type { EquipmentMaintenanceView, EquipmentItemView } from "@/lib/data/client";
import { useEquipmentI18n } from "@/lib/hooks/use-equipment-i18n";
import { useEquipmentLocale } from "../layout";

const STATUS_OPTIONS = ["all", "scheduled", "in_progress", "completed", "cancelled"] as const;
const TYPE_OPTIONS = ["routine", "repair", "calibration", "inspection", "cleaning"] as const;

const statusColors: Record<string, string> = {
  scheduled: "bg-cyan-100 text-cyan-700 border-0",
  in_progress: "bg-blue-100 text-blue-700 border-0",
  completed: "bg-emerald-100 text-emerald-700 border-0",
  cancelled: "bg-gray-100 text-gray-700 border-0",
};

const typeColors: Record<string, string> = {
  routine: "bg-blue-100 text-blue-700 border-0",
  repair: "bg-orange-100 text-orange-700 border-0",
  calibration: "bg-purple-100 text-purple-700 border-0",
  inspection: "bg-cyan-100 text-cyan-700 border-0",
  cleaning: "bg-emerald-100 text-emerald-700 border-0",
};

interface MaintenanceFormState {
  equipmentId: string;
  type: string;
  description: string;
  performedBy: string;
  performedAt: string;
  nextDue: string;
  cost: string;
  status: string;
  notes: string;
}

const emptyForm: MaintenanceFormState = {
  equipmentId: "", type: "routine", description: "", performedBy: "",
  performedAt: new Date().toISOString().split("T")[0], nextDue: "",
  cost: "", status: "scheduled", notes: "",
};

export default function EquipmentMaintenancePage() {
  const { locale } = useEquipmentLocale();
  const { t } = useEquipmentI18n(locale);
  const tenant = useTenant();
  const [records, setRecords] = useState<EquipmentMaintenanceView[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EquipmentMaintenanceView | null>(null);
  const [form, setForm] = useState<MaintenanceFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const dateFmt = locale === "ar" ? "ar-MA" : "fr-FR";

  const typeLabel = useCallback((tp: string) => {
    const map: Record<string, string> = {
      routine: t("typeRoutine"), repair: t("typeRepair"),
      calibration: t("typeCalibration"), inspection: t("typeInspection"),
      cleaning: t("typeCleaning"),
    };
    return map[tp] ?? tp;
  }, [t]);

  const statusLabel = useCallback((s: string) => {
    const map: Record<string, string> = {
      scheduled: t("statusScheduled"), in_progress: t("statusInProgress"),
      completed: t("statusCompleted"), cancelled: t("statusCancelled"),
    };
    return map[s] ?? s;
  }, [t]);

  function reload() {
    setLoading(true);
    const cId = tenant?.clinicId ?? "";
    Promise.all([fetchEquipmentMaintenance(cId), fetchEquipmentInventory(cId)])
      .then(([r, e]) => { setRecords(r); setEquipment(e); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const controller = new AbortController();
    function init() {
      setLoading(true);
      const cId = tenant?.clinicId ?? "";
      Promise.all([fetchEquipmentMaintenance(cId), fetchEquipmentInventory(cId)])
        .then(([r, e]) => { setRecords(r); setEquipment(e); })
        .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
    }
    init();
  }, [tenant?.clinicId]);

  const openAddDialog = () => {
    setEditingRecord(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (record: EquipmentMaintenanceView) => {
    setEditingRecord(record);
    setForm({
      equipmentId: record.equipmentId,
      type: record.type,
      description: record.description ?? "",
      performedBy: record.performedBy ?? "",
      performedAt: record.performedAt,
      nextDue: record.nextDue ?? "",
      cost: record.cost != null ? String(record.cost) : "",
      status: record.status,
      notes: record.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.equipmentId || !form.type || !form.performedAt) return;
    setSaving(true);
    if (editingRecord) {
      await updateEquipmentMaintenance(editingRecord.id, {
        equipment_id: form.equipmentId,
        type: form.type,
        description: form.description || null,
        performed_by: form.performedBy || null,
        performed_at: form.performedAt,
        next_due: form.nextDue || null,
        cost: form.cost ? Number(form.cost) : null,
        status: form.status,
        notes: form.notes || null,
      });
    } else {
      await createEquipmentMaintenance({
        clinic_id: tenant?.clinicId ?? "",
        equipment_id: form.equipmentId,
        type: form.type,
        description: form.description || undefined,
        performed_by: form.performedBy || undefined,
        performed_at: form.performedAt,
        next_due: form.nextDue || undefined,
        cost: form.cost ? Number(form.cost) : undefined,
        status: form.status,
        notes: form.notes || undefined,
      });
    }
    setSaving(false);
    setDialogOpen(false);
    reload();
  };

  const handleDelete = async (id: string) => {
    await deleteEquipmentMaintenance(id);
    setDeleteConfirm(null);
    reload();
  };

  const updateField = (field: keyof MaintenanceFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <PageLoader message="Loading..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  const filtered = records.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.equipmentName.toLowerCase().includes(q) || r.type.toLowerCase().includes(q) || (r.performedBy?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const upcoming = records.filter((r) => {
    if (r.status !== "scheduled") return false;
    if (!r.nextDue) return false;
    const due = new Date(r.nextDue);
    return due <= thirtyDaysFromNow && due >= now;
  });

  const overdueMaint = records.filter((r) => {
    if (r.status !== "scheduled" || !r.nextDue) return false;
    return new Date(r.nextDue) < now;
  });

  const getDaysUntilDue = (dateStr: string) => {
    const due = new Date(dateStr);
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("maintenanceTitle")}</h1>
          <p className="text-muted-foreground text-sm">{records.length} {t("maintenanceRecords")}</p>
        </div>
        <Button onClick={openAddDialog} size="sm" className="bg-amber-600 hover:bg-amber-700">
          <Plus className="h-4 w-4 me-1" /> {t("addMaintenance")}
        </Button>
      </div>

      {/* Overdue maintenance alerts */}
      {overdueMaint.length > 0 && (
        <Card className="mb-4 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/10">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-sm text-red-700">
                {t("overdueMaintenance")} ({overdueMaint.length})
              </h3>
            </div>
            <div className="space-y-2">
              {overdueMaint.map((m) => {
                const daysOverdue = Math.abs(getDaysUntilDue(m.nextDue!));
                return (
                  <div key={m.id} className="flex items-center justify-between p-2 bg-red-100/50 dark:bg-red-950/20 rounded">
                    <div>
                      <p className="font-medium text-sm">{m.equipmentName}</p>
                      <p className="text-xs text-red-600">
                        {typeLabel(m.type)} &middot; {t("overdue")} {daysOverdue} {t("days")}
                      </p>
                    </div>
                    <Badge className="bg-red-100 text-red-700 border-0 text-xs">{t("overdue")}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming maintenance alerts */}
      {upcoming.length > 0 && (
        <Card className="mb-6 border-orange-200 dark:border-orange-900">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold text-sm">
                {t("upcomingMaintenance")} ({upcoming.length})
              </h3>
            </div>
            <div className="space-y-2">
              {upcoming.map((m) => {
                const daysLeft = getDaysUntilDue(m.nextDue!);
                return (
                  <div key={m.id} className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-950/10 rounded">
                    <div>
                      <p className="font-medium text-sm">{m.equipmentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {typeLabel(m.type)} &middot; {t("dueIn")} {daysLeft} {t("days")}
                      </p>
                    </div>
                    <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">{typeLabel(m.type)}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={`${t("search")}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
              {s === "all" ? t("all") : statusLabel(s)}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((record) => (
          <Card key={record.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium">{record.equipmentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(record.performedAt).toLocaleDateString(dateFmt)} &middot; {record.performedBy ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={typeColors[record.type] ?? "bg-gray-100 text-gray-700 border-0"}>
                    {typeLabel(record.type)}
                  </Badge>
                  <Badge className={statusColors[record.status] ?? "bg-gray-100 text-gray-700 border-0"}>
                    {statusLabel(record.status)}
                  </Badge>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === record.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {expandedId === record.id && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">{t("maintenanceType")}</p>
                      <p className="font-medium">{typeLabel(record.type)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t("performedBy")}</p>
                      <p className="font-medium">{record.performedBy ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t("cost")}</p>
                      <p className="font-medium">{record.cost != null ? `${record.cost} ${record.currency}` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t("nextDue")}</p>
                      <p className="font-medium">{record.nextDue ? new Date(record.nextDue).toLocaleDateString(dateFmt) : "—"}</p>
                    </div>
                  </div>
                  {record.description && (
                    <div className="text-sm mt-3">
                      <p className="text-muted-foreground text-xs">{t("description")}</p>
                      <p>{record.description}</p>
                    </div>
                  )}
                  {record.notes && (
                    <div className="text-sm mt-3">
                      <p className="text-muted-foreground text-xs">{t("notes")}</p>
                      <p>{record.notes}</p>
                    </div>
                  )}
                  <div className="mt-4 pt-3 border-t flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEditDialog(record); }}>
                      <Pencil className="h-3 w-3 me-1" /> {t("edit")}
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 ms-auto" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(record.id); }}>
                      <Trash2 className="h-3 w-3 me-1" /> {t("delete")}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t("noMaintenanceMatch")}</p>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecord ? t("editMaintenance") : t("addMaintenance")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>{t("equipment")} *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.equipmentId}
                onChange={(e) => updateField("equipmentId", e.target.value)}
              >
                <option value="">{t("selectEquipment")}</option>
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} {e.serialNumber ? `(S/N: ${e.serialNumber})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("maintenanceType")} *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.type}
                  onChange={(e) => updateField("type", e.target.value)}
                >
                  {TYPE_OPTIONS.map((tp) => (
                    <option key={tp} value={tp}>{typeLabel(tp)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{t("rentalStatus")}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                >
                  {STATUS_OPTIONS.filter((s) => s !== "all").map((s) => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("performedAt")} *</Label>
                <Input type="date" value={form.performedAt} onChange={(e) => updateField("performedAt", e.target.value)} />
              </div>
              <div>
                <Label>{t("nextDue")}</Label>
                <Input type="date" value={form.nextDue} onChange={(e) => updateField("nextDue", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("performedBy")}</Label>
                <Input value={form.performedBy} onChange={(e) => updateField("performedBy", e.target.value)} />
              </div>
              <div>
                <Label>{t("cost")} (MAD)</Label>
                <Input type="number" value={form.cost} onChange={(e) => updateField("cost", e.target.value)} />
              </div>
            </div>
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
            <Button
              onClick={handleSave}
              disabled={saving || !form.equipmentId || !form.type || !form.performedAt}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {saving ? t("loading") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent onClose={() => setDeleteConfirm(null)}>
          <DialogHeader>
            <DialogTitle>{t("delete")}</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-sm">{locale === "fr" ? "Êtes-vous sûr de vouloir supprimer cet enregistrement de maintenance ?" : "هل أنت متأكد من حذف سجل الصيانة هذا؟"}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>{t("delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
