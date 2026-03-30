"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search, Filter, ChevronDown, Scan, Plus,
  FileText, Loader2,
} from "lucide-react";
import { useTenant } from "@/components/tenant-provider";
import { fetchRadiologyOrders, fetchRadiologyTemplates } from "@/lib/data/client";
import type { RadiologyOrderView, RadiologyTemplateView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

const statusOptions = ["all", "pending", "scheduled", "in_progress", "images_ready", "reported", "validated", "cancelled"] as const;
const modalityOptions = ["xray", "ct", "mri", "ultrasound", "mammography", "pet", "fluoroscopy", "other"] as const;
const priorityOptions = ["normal", "urgent", "stat"] as const;

export default function RadiologyOrdersPage() {
  const tenant = useTenant();
  const [orders, setOrders] = useState<RadiologyOrderView[]>([]);
  const [templates, setTemplates] = useState<RadiologyTemplateView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrderSaving, setNewOrderSaving] = useState(false);
  const [newOrder, setNewOrder] = useState({
    patientId: "",
    modality: "xray" as string,
    bodyPart: "",
    clinicalIndication: "",
    priority: "normal" as string,
    scheduledAt: "",
  });

  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportOrderId, setReportOrderId] = useState<string | null>(null);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportData, setReportData] = useState({
    findings: "",
    impression: "",
    reportText: "",
    templateId: "",
  });

  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const refreshOrders = useCallback(() => {
    if (!tenant?.clinicId) return;
    fetchRadiologyOrders(tenant.clinicId).then(setOrders);
  }, [tenant?.clinicId]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchRadiologyOrders(tenant?.clinicId ?? ""),
      fetchRadiologyTemplates(tenant?.clinicId ?? ""),
    ]).then(([o, t]) => {
      if (controller.signal.aborted) return;
      setOrders(o);
      setTemplates(t);
    }).catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => { controller.abort(); };
  }, [tenant?.clinicId]);

  const handleCreateOrder = async () => {
    if (!newOrder.patientId || !newOrder.modality) return;
    setNewOrderSaving(true);
    try {
      const res = await fetch("/api/radiology/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId: tenant?.clinicId ?? "",
          patientId: newOrder.patientId,
          modality: newOrder.modality,
          bodyPart: newOrder.bodyPart || undefined,
          clinicalIndication: newOrder.clinicalIndication || undefined,
          priority: newOrder.priority,
          scheduledAt: newOrder.scheduledAt || undefined,
        }),
      });
      if (res.ok) {
        setNewOrderOpen(false);
        setNewOrder({ patientId: "", modality: "xray", bodyPart: "", clinicalIndication: "", priority: "normal", scheduledAt: "" });
        refreshOrders();
      }
    } finally {
      setNewOrderSaving(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdatingStatusId(orderId);
    // Issue 22: Optimistic UI — update status locally before server response
    const previousOrders = [...orders];
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    try {
      const res = await fetch("/api/radiology/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action: "status", status: newStatus }),
      });
      if (res.ok) refreshOrders();
      else setOrders(previousOrders); // Roll back on failure
    } catch {
      setOrders(previousOrders); // Roll back on error
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const openReportDialog = (order: RadiologyOrderView) => {
    setReportOrderId(order.id);
    setReportData({
      findings: order.findings ?? "",
      impression: order.impression ?? "",
      reportText: order.reportText ?? "",
      templateId: "",
    });
    setReportDialogOpen(true);
  };

  const handleApplyTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const text = tpl.sections.map((s) => `## ${s.title}\n${s.defaultContent}`).join("\n\n");
    setReportData((prev) => ({ ...prev, reportText: text, templateId }));
  };

  const handleSaveReport = async () => {
    if (!reportOrderId) return;
    setReportSaving(true);
    try {
      const res = await fetch("/api/radiology/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: reportOrderId,
          action: "report",
          findings: reportData.findings,
          impression: reportData.impression,
          reportText: reportData.reportText,
          templateId: reportData.templateId || undefined,
        }),
      });
      if (res.ok) {
        setReportDialogOpen(false);
        refreshOrders();
      }
    } finally {
      setReportSaving(false);
    }
  };

  const handleGeneratePdf = async (order: RadiologyOrderView) => {
    const res = await fetch("/api/radiology/report-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        clinicId: tenant?.clinicId ?? "",
        patientName: order.patientName,
        modality: order.modality,
        bodyPart: order.bodyPart,
        findings: order.findings,
        impression: order.impression,
        reportText: order.reportText,
        radiologistName: order.radiologistName,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank");
        refreshOrders();
      }
    }
  };

  if (loading) {
    return <PageLoader message="Loading orders..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return o.patientName.toLowerCase().includes(q) || o.orderNumber.toLowerCase().includes(q);
    }
    return true;
  });

  const getNextStatus = (current: string): string | null => {
    const flow: Record<string, string> = {
      pending: "scheduled",
      scheduled: "in_progress",
      in_progress: "images_ready",
      images_ready: "reported",
    };
    return flow[current] ?? null;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Study Orders</h1>
          <p className="text-muted-foreground text-sm">{orders.length} total orders</p>
        </div>
        <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Order</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Radiology Order</DialogTitle>
              <DialogDescription>Request a new imaging study for a patient.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="patientId">Patient ID</Label>
                <Input id="patientId" placeholder="Patient UUID" value={newOrder.patientId} onChange={(e) => setNewOrder((p) => ({ ...p, patientId: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Modality</Label>
                  <Select value={newOrder.modality} onValueChange={(v) => setNewOrder((p) => ({ ...p, modality: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {modalityOptions.map((m) => (
                        <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Select value={newOrder.priority} onValueChange={(v) => setNewOrder((p) => ({ ...p, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((pr) => (
                        <SelectItem key={pr} value={pr} className="capitalize">{pr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bodyPart">Body Part</Label>
                <Input id="bodyPart" placeholder="e.g., Chest, Knee, Brain" value={newOrder.bodyPart} onChange={(e) => setNewOrder((p) => ({ ...p, bodyPart: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="indication">Clinical Indication</Label>
                <Textarea id="indication" placeholder="Reason for imaging..." value={newOrder.clinicalIndication} onChange={(e) => setNewOrder((p) => ({ ...p, clinicalIndication: e.target.value }))} rows={2} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scheduledAt">Scheduled Date/Time</Label>
                <Input id="scheduledAt" type="datetime-local" value={newOrder.scheduledAt} onChange={(e) => setNewOrder((p) => ({ ...p, scheduledAt: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewOrderOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateOrder} disabled={newOrderSaving || !newOrder.patientId}>
                {newOrderSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by patient, order number..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statusOptions.map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)} className="capitalize">
              {s === "all" ? "All" : s.replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((order) => (
          <Card key={order.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Scan className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium">{order.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.orderNumber} &middot; {order.modality.toUpperCase()} &middot; {order.bodyPart ?? "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {(order.priority === "urgent" || order.priority === "stat") && (
                    <Badge variant="destructive" className="text-xs uppercase">{order.priority}</Badge>
                  )}
                  <Badge className={
                    order.status === "pending" ? "bg-yellow-100 text-yellow-700 border-0" :
                    order.status === "scheduled" ? "bg-cyan-100 text-cyan-700 border-0" :
                    order.status === "in_progress" ? "bg-blue-100 text-blue-700 border-0" :
                    order.status === "images_ready" ? "bg-purple-100 text-purple-700 border-0" :
                    order.status === "reported" ? "bg-emerald-100 text-emerald-700 border-0" :
                    order.status === "validated" ? "bg-green-100 text-green-700 border-0" :
                    "bg-gray-100 text-gray-700 border-0"
                  }>
                    {order.status.replace("_", " ")}
                  </Badge>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === order.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {expandedId === order.id && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Ordering Doctor</p>
                      <p className="font-medium">{order.orderingDoctorName ?? "\u2014"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Radiologist</p>
                      <p className="font-medium">{order.radiologistName ?? "Unassigned"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Scheduled</p>
                      <p className="font-medium">{order.scheduledAt ? new Date(order.scheduledAt).toLocaleString() : "\u2014"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Images</p>
                      <p className="font-medium">{order.imageCount} image{order.imageCount !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  {order.clinicalIndication && (
                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs">Clinical Indication</p>
                      <p>{order.clinicalIndication}</p>
                    </div>
                  )}
                  {order.findings && (
                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs">Findings</p>
                      <p>{order.findings}</p>
                    </div>
                  )}
                  {order.impression && (
                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs">Impression</p>
                      <p className="font-medium">{order.impression}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {getNextStatus(order.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, getNextStatus(order.status)!); }}
                        disabled={updatingStatusId === order.id}
                      >
                        {updatingStatusId === order.id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        Move to {getNextStatus(order.status)!.replace("_", " ")}
                      </Button>
                    )}
                    {order.status !== "cancelled" && order.status !== "validated" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); openReportDialog(order); }}
                      >
                        <FileText className="h-3 w-3 mr-1" /> Write Report
                      </Button>
                    )}
                    {(order.status === "reported" || order.status === "validated") && order.findings && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleGeneratePdf(order); }}
                      >
                        Generate PDF
                      </Button>
                    )}
                    {order.status !== "cancelled" && order.status !== "validated" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, "cancelled"); }}
                        disabled={updatingStatusId === order.id}
                      >
                        Cancel Order
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No orders match your filters</p>
          </div>
        )}
      </div>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Write Radiology Report</DialogTitle>
            <DialogDescription>Enter findings and impression for this study.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {templates.length > 0 && (
              <div className="grid gap-2">
                <Label>Load from Template</Label>
                <Select value={reportData.templateId} onValueChange={handleApplyTemplate}>
                  <SelectTrigger><SelectValue placeholder="Select a template..." /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="findings">Findings</Label>
              <Textarea id="findings" placeholder="Describe the findings..." value={reportData.findings} onChange={(e) => setReportData((p) => ({ ...p, findings: e.target.value }))} rows={4} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="impression">Impression</Label>
              <Textarea id="impression" placeholder="Summary / Impression..." value={reportData.impression} onChange={(e) => setReportData((p) => ({ ...p, impression: e.target.value }))} rows={3} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reportText">Full Report</Label>
              <Textarea id="reportText" placeholder="Complete report text..." value={reportData.reportText} onChange={(e) => setReportData((p) => ({ ...p, reportText: e.target.value }))} rows={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveReport} disabled={reportSaving || (!reportData.findings && !reportData.impression && !reportData.reportText)}>
              {reportSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
