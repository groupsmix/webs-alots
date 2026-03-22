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
import { Search, HandCoins, ChevronDown, AlertTriangle, Plus, Pencil, Trash2, RotateCcw } from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import {
  fetchEquipmentRentals, fetchEquipmentInventory,
  createEquipmentRental, updateEquipmentRental, deleteEquipmentRental,
} from "@/lib/data/client";
import type { EquipmentRentalView, EquipmentItemView } from "@/lib/data/client";
import { useEquipmentLocale } from "../../layout";
import { useEquipmentI18n } from "@/lib/hooks/use-equipment-i18n";
import { PageLoader } from "@/components/ui/page-loader";

const STATUS_OPTIONS = ["all", "reserved", "active", "returned", "overdue", "cancelled"] as const;
const PAYMENT_OPTIONS = ["pending", "partial", "paid", "refunded"] as const;
const CONDITIONS = ["new", "good", "fair", "needs_repair"] as const;

const statusColors: Record<string, string> = {
  reserved: "bg-cyan-100 text-cyan-700 border-0",
  active: "bg-blue-100 text-blue-700 border-0",
  returned: "bg-emerald-100 text-emerald-700 border-0",
  overdue: "bg-red-100 text-red-700 border-0",
  cancelled: "bg-gray-100 text-gray-700 border-0",
};

interface RentalFormState {
  equipmentId: string;
  clientName: string;
  clientPhone: string;
  clientIdNumber: string;
  rentalStart: string;
  rentalEnd: string;
  conditionOut: string;
  depositAmount: string;
  rentalAmount: string;
  paymentStatus: string;
  notes: string;
}

const emptyRentalForm: RentalFormState = {
  equipmentId: "", clientName: "", clientPhone: "", clientIdNumber: "",
  rentalStart: "", rentalEnd: "", conditionOut: "good", depositAmount: "",
  rentalAmount: "", paymentStatus: "pending", notes: "",
};

export default function EquipmentRentalsPage() {
  const { locale } = useEquipmentLocale();
  const { t } = useEquipmentI18n(locale);
  const [rentals, setRentals] = useState<EquipmentRentalView[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRental, setEditingRental] = useState<EquipmentRentalView | null>(null);
  const [form, setForm] = useState<RentalFormState>(emptyRentalForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [returnDialog, setReturnDialog] = useState<EquipmentRentalView | null>(null);
  const [returnCondition, setReturnCondition] = useState("good");

  const dateFmt = locale === "ar" ? "ar-MA" : "fr-FR";

  const statusLabel = useCallback((s: string) => {
    const map: Record<string, string> = {
      reserved: t("statusReserved"), active: t("statusActive"),
      returned: t("statusReturned"), overdue: t("statusOverdue"),
      cancelled: t("statusCancelled"),
    };
    return map[s] ?? s;
  }, [t]);

  const paymentLabel = useCallback((s: string) => {
    const map: Record<string, string> = {
      pending: t("paymentPending"), partial: t("paymentPartial"),
      paid: t("paymentPaid"), refunded: t("paymentRefunded"),
    };
    return map[s] ?? s;
  }, [t]);

  const conditionLabel = useCallback((c: string) => {
    const map: Record<string, string> = {
      new: t("conditionNew"), good: t("conditionGood"),
      fair: t("conditionFair"), needs_repair: t("conditionNeedsRepair"),
    };
    return map[c] ?? c;
  }, [t]);

  function reload() {
    setLoading(true);
    const cId = clinicConfig.clinicId;
    Promise.all([fetchEquipmentRentals(cId), fetchEquipmentInventory(cId)])
      .then(([r, e]) => { setRentals(r); setEquipment(e); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    function init() {
      setLoading(true);
      const cId = clinicConfig.clinicId;
      Promise.all([fetchEquipmentRentals(cId), fetchEquipmentInventory(cId)])
        .then(([r, e]) => { setRentals(r); setEquipment(e); })
        .finally(() => setLoading(false));
    }
    init();
  }, []);

  const openAddDialog = () => {
    setEditingRental(null);
    setForm(emptyRentalForm);
    setDialogOpen(true);
  };

  const openEditDialog = (rental: EquipmentRentalView) => {
    setEditingRental(rental);
    setForm({
      equipmentId: rental.equipmentId,
      clientName: rental.clientName,
      clientPhone: rental.clientPhone ?? "",
      clientIdNumber: rental.clientIdNumber ?? "",
      rentalStart: rental.rentalStart,
      rentalEnd: rental.rentalEnd ?? "",
      conditionOut: rental.conditionOut,
      depositAmount: rental.depositAmount != null ? String(rental.depositAmount) : "",
      rentalAmount: rental.rentalAmount != null ? String(rental.rentalAmount) : "",
      paymentStatus: rental.paymentStatus,
      notes: rental.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.equipmentId || !form.clientName || !form.rentalStart || !form.conditionOut) return;
    setSaving(true);
    if (editingRental) {
      await updateEquipmentRental(editingRental.id, {
        client_name: form.clientName,
        client_phone: form.clientPhone || null,
        client_id_number: form.clientIdNumber || null,
        rental_start: form.rentalStart,
        rental_end: form.rentalEnd || null,
        condition_out: form.conditionOut,
        deposit_amount: form.depositAmount ? Number(form.depositAmount) : null,
        rental_amount: form.rentalAmount ? Number(form.rentalAmount) : null,
        payment_status: form.paymentStatus,
        notes: form.notes || null,
      });
    } else {
      await createEquipmentRental({
        clinic_id: clinicConfig.clinicId,
        equipment_id: form.equipmentId,
        client_name: form.clientName,
        client_phone: form.clientPhone || undefined,
        client_id_number: form.clientIdNumber || undefined,
        rental_start: form.rentalStart,
        rental_end: form.rentalEnd || undefined,
        condition_out: form.conditionOut,
        deposit_amount: form.depositAmount ? Number(form.depositAmount) : undefined,
        rental_amount: form.rentalAmount ? Number(form.rentalAmount) : undefined,
        payment_status: form.paymentStatus,
        notes: form.notes || undefined,
      });
    }
    setSaving(false);
    setDialogOpen(false);
    reload();
  };

  const handleDelete = async (id: string) => {
    await deleteEquipmentRental(id);
    setDeleteConfirm(null);
    reload();
  };

  const handleReturn = async () => {
    if (!returnDialog) return;
    await updateEquipmentRental(returnDialog.id, {
      status: "returned",
      condition_in: returnCondition,
      actual_return: new Date().toISOString().split("T")[0],
    });
    setReturnDialog(null);
    reload();
  };

  const updateField = (field: keyof RentalFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <PageLoader message="Loading..." />;
  }

  const filtered = rentals.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.equipmentName.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("rentalsTitle")}</h1>
          <p className="text-muted-foreground text-sm">{rentals.length} {t("rentalRecords")}</p>
        </div>
        <Button onClick={openAddDialog} size="sm" className="bg-amber-600 hover:bg-amber-700">
          <Plus className="h-4 w-4 me-1" /> {t("addRental")}
        </Button>
      </div>

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
        {filtered.map((rental) => (
          <Card key={rental.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === rental.id ? null : rental.id)}>
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    rental.status === "overdue" ? "bg-red-100 dark:bg-red-900/30" : "bg-blue-100 dark:bg-blue-900/30"
                  }`}>
                    {rental.status === "overdue" ? (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    ) : (
                      <HandCoins className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{rental.equipmentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {rental.clientName} &middot; {new Date(rental.rentalStart).toLocaleDateString(dateFmt)}
                      {rental.rentalEnd ? ` — ${new Date(rental.rentalEnd).toLocaleDateString(dateFmt)}` : ` — ${t("ongoing")}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={statusColors[rental.status] ?? "bg-gray-100 text-gray-700 border-0"}>
                    {statusLabel(rental.status)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{paymentLabel(rental.paymentStatus)}</Badge>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === rental.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {expandedId === rental.id && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">{t("clientPhone")}</p>
                      <p className="font-medium">{rental.clientPhone ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t("clientId")}</p>
                      <p className="font-medium">{rental.clientIdNumber ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t("deposit")}</p>
                      <p className="font-medium">{rental.depositAmount != null ? `${rental.depositAmount} ${rental.currency}` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t("rentalAmount")}</p>
                      <p className="font-medium">{rental.rentalAmount != null ? `${rental.rentalAmount} ${rental.currency}` : "—"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                    <div>
                      <p className="text-muted-foreground text-xs">{t("conditionOut")}</p>
                      <p className="font-medium">{conditionLabel(rental.conditionOut)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t("conditionIn")}</p>
                      <p className="font-medium">{rental.conditionIn ? conditionLabel(rental.conditionIn) : t("notYetReturned")}</p>
                    </div>
                  </div>
                  {rental.actualReturn && (
                    <div className="text-sm mt-3">
                      <p className="text-muted-foreground text-xs">{t("actualReturn")}</p>
                      <p className="font-medium">{new Date(rental.actualReturn).toLocaleDateString(dateFmt)}</p>
                    </div>
                  )}
                  {rental.notes && (
                    <div className="text-sm mt-3">
                      <p className="text-muted-foreground text-xs">{t("notes")}</p>
                      <p>{rental.notes}</p>
                    </div>
                  )}
                  <div className="mt-4 pt-3 border-t flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEditDialog(rental); }}>
                      <Pencil className="h-3 w-3 me-1" /> {t("edit")}
                    </Button>
                    {(rental.status === "active" || rental.status === "overdue") && (
                      <Button variant="outline" size="sm" className="text-emerald-600" onClick={(e) => { e.stopPropagation(); setReturnDialog(rental); setReturnCondition("good"); }}>
                        <RotateCcw className="h-3 w-3 me-1" /> {t("returnEquipment")}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 ms-auto" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(rental.id); }}>
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
            <HandCoins className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t("noRentalsMatch")}</p>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRental ? t("editRental") : t("addRental")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!editingRental && (
              <div>
                <Label>{t("equipment")} *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.equipmentId}
                  onChange={(e) => updateField("equipmentId", e.target.value)}
                >
                  <option value="">{t("selectEquipment")}</option>
                  {equipment.filter((e) => e.isRentable && e.isAvailable).map((e) => (
                    <option key={e.id} value={e.id}>{e.name} {e.serialNumber ? `(S/N: ${e.serialNumber})` : ""}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("clientName")} *</Label>
                <Input value={form.clientName} onChange={(e) => updateField("clientName", e.target.value)} />
              </div>
              <div>
                <Label>{t("clientPhone")}</Label>
                <Input value={form.clientPhone} onChange={(e) => updateField("clientPhone", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{t("clientId")}</Label>
              <Input value={form.clientIdNumber} onChange={(e) => updateField("clientIdNumber", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("rentalStart")} *</Label>
                <Input type="date" value={form.rentalStart} onChange={(e) => updateField("rentalStart", e.target.value)} />
              </div>
              <div>
                <Label>{t("rentalEnd")}</Label>
                <Input type="date" value={form.rentalEnd} onChange={(e) => updateField("rentalEnd", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("conditionOut")} *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.conditionOut}
                  onChange={(e) => updateField("conditionOut", e.target.value)}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>{conditionLabel(c)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{t("paymentStatus")}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.paymentStatus}
                  onChange={(e) => updateField("paymentStatus", e.target.value)}
                >
                  {PAYMENT_OPTIONS.map((p) => (
                    <option key={p} value={p}>{paymentLabel(p)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("deposit")} (MAD)</Label>
                <Input type="number" value={form.depositAmount} onChange={(e) => updateField("depositAmount", e.target.value)} />
              </div>
              <div>
                <Label>{t("rentalAmount")} (MAD)</Label>
                <Input type="number" value={form.rentalAmount} onChange={(e) => updateField("rentalAmount", e.target.value)} />
              </div>
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
              disabled={saving || !form.clientName || !form.rentalStart || !form.conditionOut || (!editingRental && !form.equipmentId)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {saving ? t("loading") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return dialog */}
      <Dialog open={returnDialog !== null} onOpenChange={() => setReturnDialog(null)}>
        <DialogContent onClose={() => setReturnDialog(null)}>
          <DialogHeader>
            <DialogTitle>{t("returnEquipment")}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm">{returnDialog?.equipmentName} — {returnDialog?.clientName}</p>
            <div>
              <Label>{t("conditionIn")}</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value)}
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{conditionLabel(c)}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialog(null)}>{t("cancel")}</Button>
            <Button onClick={handleReturn} className="bg-emerald-600 hover:bg-emerald-700">{t("confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent onClose={() => setDeleteConfirm(null)}>
          <DialogHeader>
            <DialogTitle>{t("delete")}</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-sm">{locale === "fr" ? "Êtes-vous sûr de vouloir supprimer cette location ?" : "هل أنت متأكد من حذف هذا الإيجار؟"}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>{t("delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
