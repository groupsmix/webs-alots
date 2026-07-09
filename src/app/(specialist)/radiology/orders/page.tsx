"use client";

import { Search, Filter, ChevronDown, Scan, Plus, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-switcher";
import { useTenant } from "@/components/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchRadiologyOrders, fetchRadiologyTemplates } from "@/lib/data/client";
import type { RadiologyOrderView, RadiologyTemplateView } from "@/lib/data/client";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { formatCurrency, formatNumber } from "@/lib/utils";

const statusOptions = [
  "all",
  "pending",
  "scheduled",
  "in_progress",
  "images_ready",
  "reported",
  "validated",
  "cancelled",
] as const;
const modalityOptions = [
  "xray",
  "ct",
  "mri",
  "ultrasound",
  "mammography",
  "pet",
  "fluoroscopy",
  "other",
] as const;
const priorityOptions = ["normal", "urgent", "stat"] as const;
const RADIOLOGY_ACTIONS_DISABLED_MESSAGE =
  "Ordering, report editing, status updates, and PDF generation are temporarily unavailable in this deployment.";

export default function RadiologyOrdersPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [locale] = useLocale();

  const tenant = useTenant();
  const [orders, setOrders] = useState<RadiologyOrderView[]>([]);
  const [templates, setTemplates] = useState<RadiologyTemplateView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({
    patientId: "",
    modality: "xray" as string,
    bodyPart: "",
    clinicalIndication: "",
    priority: "normal" as string,
    scheduledAt: "",
  });

  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportData, setReportData] = useState({
    findings: "",
    impression: "",
    reportText: "",
    templateId: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchRadiologyOrders(tenant?.clinicId ?? ""),
      fetchRadiologyTemplates(tenant?.clinicId ?? ""),
    ])
      .then(([o, t]) => {
        if (controller.signal.aborted) return;
        setOrders(o);
        setTemplates(t);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [tenant?.clinicId]);

  const handleCreateOrder = async () => {
    setNewOrderOpen(false);
  };

  const handleStatusUpdate = async (_orderId: string, _newStatus: string) => {};

  const openReportDialog = (order: RadiologyOrderView) => {
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
    setReportDialogOpen(false);
  };

  const handleGeneratePdf = async (_order: RadiologyOrderView) => {};

  if (loading) {
    return <PageLoader message="Loading orders..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">
          Failed to load data. Please try refreshing the page.
        </p>
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
      <div className="space-y-4 mb-6">
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {RADIOLOGY_ACTIONS_DISABLED_MESSAGE}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Study Orders</h1>
            <p className="text-muted-foreground text-sm">Manage imaging orders and workflow</p>
          </div>
          <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
            <DialogTrigger asChild>
              <Button disabled title={RADIOLOGY_ACTIONS_DISABLED_MESSAGE}>
                <Plus className="h-4 w-4 mr-2" /> New Order
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Radiology Order</DialogTitle>
                <DialogDescription>
                  Radiology order creation is disabled in this deployment.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="patientId">Patient ID</Label>
                  <Input
                    id="patientId"
                    placeholder="Patient UUID"
                    value={newOrder.patientId}
                    onChange={(e) => setNewOrder((p) => ({ ...p, patientId: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Modality</Label>
                    <Select
                      value={newOrder.modality}
                      onValueChange={(v) => setNewOrder((p) => ({ ...p, modality: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {modalityOptions.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Priority</Label>
                    <Select
                      value={newOrder.priority}
                      onValueChange={(v) => setNewOrder((p) => ({ ...p, priority: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorityOptions.map((pr) => (
                          <SelectItem key={pr} value={pr} className="capitalize">
                            {pr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bodyPart">Body Part</Label>
                  <Input
                    id="bodyPart"
                    placeholder="e.g., Chest, Knee, Brain"
                    value={newOrder.bodyPart}
                    onChange={(e) => setNewOrder((p) => ({ ...p, bodyPart: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="indication">Clinical Indication</Label>
                  <Textarea
                    id="indication"
                    placeholder="Reason for imaging..."
                    value={newOrder.clinicalIndication}
                    onChange={(e) =>
                      setNewOrder((p) => ({ ...p, clinicalIndication: e.target.value }))
                    }
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="scheduledAt">Scheduled Date/Time</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={newOrder.scheduledAt}
                    onChange={(e) => setNewOrder((p) => ({ ...p, scheduledAt: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewOrderOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateOrder}
                  disabled
                  title={RADIOLOGY_ACTIONS_DISABLED_MESSAGE}
                >
                  Create Order
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient, order number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statusOptions.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="capitalize"
            >
              {s === "all" ? "All" : s.replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((order) => (
          <Card key={order.id}>
            <CardContent className="pt-4 pb-4">
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- keyboard interaction handled by parent or child interactive element */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Scan className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium">{order.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.orderNumber} &middot; {order.modality.toUpperCase()} &middot;{" "}
                      {order.bodyPart ?? "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {(order.priority === "urgent" || order.priority === "stat") && (
                    <Badge variant="destructive" className="text-xs uppercase">
                      {order.priority}
                    </Badge>
                  )}
                  <Badge
                    className={
                      order.status === "pending"
                        ? "bg-yellow-100 text-yellow-700 border-0"
                        : order.status === "scheduled"
                          ? "bg-cyan-100 text-cyan-700 border-0"
                          : order.status === "in_progress"
                            ? "bg-blue-100 text-blue-700 border-0"
                            : order.status === "images_ready"
                              ? "bg-purple-100 text-purple-700 border-0"
                              : order.status === "reported"
                                ? "bg-emerald-100 text-emerald-700 border-0"
                                : order.status === "validated"
                                  ? "bg-green-100 text-green-700 border-0"
                                  : "bg-gray-100 text-gray-700 border-0"
                    }
                  >
                    {order.status.replace("_", " ")}
                  </Badge>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === order.id ? "rotate-180" : ""}`}
                  />
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
                      <p className="font-medium">
                        {order.scheduledAt
                          ? new Date(order.scheduledAt).toLocaleString()
                          : "\u2014"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Images</p>
                      <p className="font-medium">
                        {order.imageCount} image{order.imageCount !== 1 ? "s" : ""}
                      </p>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusUpdate(order.id, getNextStatus(order.status)!);
                        }}
                        disabled
                        title={RADIOLOGY_ACTIONS_DISABLED_MESSAGE}
                      >
                        Move to {getNextStatus(order.status)!.replace("_", " ")}
                      </Button>
                    )}
                    {order.status !== "cancelled" && order.status !== "validated" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReportDialog(order);
                        }}
                        disabled
                        title={RADIOLOGY_ACTIONS_DISABLED_MESSAGE}
                      >
                        <FileText className="h-3 w-3 mr-1" /> Write Report
                      </Button>
                    )}
                    {(order.status === "reported" || order.status === "validated") &&
                      order.findings && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGeneratePdf(order);
                          }}
                          disabled
                          title={RADIOLOGY_ACTIONS_DISABLED_MESSAGE}
                        >
                          Generate PDF
                        </Button>
                      )}
                    {order.status !== "cancelled" && order.status !== "validated" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusUpdate(order.id, "cancelled");
                        }}
                        disabled
                        title={RADIOLOGY_ACTIONS_DISABLED_MESSAGE}
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
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="findings">Findings</Label>
              <Textarea
                id="findings"
                placeholder="Describe the findings..."
                value={reportData.findings}
                onChange={(e) => setReportData((p) => ({ ...p, findings: e.target.value }))}
                rows={4}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="impression">Impression</Label>
              <Textarea
                id="impression"
                placeholder="Summary / Impression..."
                value={reportData.impression}
                onChange={(e) => setReportData((p) => ({ ...p, impression: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reportText">Full Report</Label>
              <Textarea
                id="reportText"
                placeholder="Complete report text..."
                value={reportData.reportText}
                onChange={(e) => setReportData((p) => ({ ...p, reportText: e.target.value }))}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveReport} disabled title={RADIOLOGY_ACTIONS_DISABLED_MESSAGE}>
              Save Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
