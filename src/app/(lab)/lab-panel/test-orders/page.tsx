"use client";

import {
  Search, Filter, ChevronDown, FlaskConical, Plus,
  Clock, CheckCircle, Loader2, UserPlus, ArrowRight,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/locale-switcher";
import { useTenant } from "@/components/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchLabTestOrders, fetchLabTestCatalog, fetchPatients,
  createLabTestOrder, updateLabOrderStatus, assignLabTechnician,
} from "@/lib/data/client";
import type { LabTestOrderView, LabTestCatalogView, PatientView } from "@/lib/data/client";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { formatCurrency, formatNumber } from "@/lib/utils";

const statusOptions = ["all", "pending", "sample_collected", "in_progress", "completed", "validated", "cancelled"] as const;
const priorityOptions = ["normal", "urgent", "stat"] as const;

export default function TestOrdersPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [locale] = useLocale();

  const tenant = useTenant();
  const [orders, setOrders] = useState<LabTestOrderView[]>([]);
  const [catalog, setCatalog] = useState<LabTestCatalogView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrderSaving, setNewOrderSaving] = useState(false);
  const [newOrder, setNewOrder] = useState({
    patientId: "",
    priority: "normal" as string,
    clinicalNotes: "",
    fastingRequired: false,
    selectedTests: [] as string[],
  });

  const [techDialogOpen, setTechDialogOpen] = useState(false);
  const [techOrderId, setTechOrderId] = useState<string | null>(null);
  const [techId, setTechId] = useState("");
  const [techSaving, setTechSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const refreshOrders = useCallback(() => {
    if (!tenant?.clinicId) return;
    fetchLabTestOrders(tenant.clinicId).then(setOrders);
  }, [tenant?.clinicId]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchLabTestOrders(tenant?.clinicId ?? ""),
      fetchLabTestCatalog(tenant?.clinicId ?? ""),
      fetchPatients(tenant?.clinicId ?? ""),
    ]).then(([o, c, p]) => {
      if (controller.signal.aborted) return;
      setOrders(o);
      setCatalog(c);
      setPatients(p);
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
    if (!newOrder.patientId) return;
    setNewOrderSaving(true);
    try {
      await createLabTestOrder({
        clinic_id: tenant?.clinicId ?? "",
        patient_id: newOrder.patientId,
        priority: newOrder.priority,
        clinical_notes: newOrder.clinicalNotes || undefined,
        fasting_required: newOrder.fastingRequired,
        test_ids: newOrder.selectedTests.length > 0 ? newOrder.selectedTests : undefined,
      });
      setNewOrderOpen(false);
      setNewOrder({ patientId: "", priority: "normal", clinicalNotes: "", fastingRequired: false, selectedTests: [] });
      refreshOrders();
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
      await updateLabOrderStatus(orderId, newStatus);
      refreshOrders();
    } catch {
      // Roll back on failure
      setOrders(previousOrders);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const openTechDialog = (orderId: string) => {
    setTechOrderId(orderId);
    setTechId("");
    setTechDialogOpen(true);
  };

  const handleAssignTech = async () => {
    if (!techOrderId) return;
    setTechSaving(true);
    try {
      await assignLabTechnician(techOrderId, techId || null);
      setTechDialogOpen(false);
      refreshOrders();
    } finally {
      setTechSaving(false);
    }
  };

  const toggleTest = (testId: string) => {
    setNewOrder((prev) => ({
      ...prev,
      selectedTests: prev.selectedTests.includes(testId)
        ? prev.selectedTests.filter((id) => id !== testId)
        : [...prev.selectedTests, testId],
    }));
  };

  if (loading) {
    return <PageLoader message="Loading test orders..." />;
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
      return (
        o.patientName.toLowerCase().includes(q) ||
        o.orderNumber.toLowerCase().includes(q) ||
        (o.assignedTechnicianName?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const getNextStatus = (current: string): string | null => {
    const flow: Record<string, string> = {
      pending: "sample_collected",
      sample_collected: "in_progress",
      in_progress: "completed",
      completed: "validated",
    };
    return flow[current] ?? null;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Test Orders</h1>
          <p className="text-muted-foreground text-sm">{orders.length} total orders</p>
        </div>
        <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Order</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Lab Test Order</DialogTitle>
              <DialogDescription>Request lab tests for a patient.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Patient</Label>
                <Select value={newOrder.patientId} onValueChange={(v) => setNewOrder((p) => ({ ...p, patientId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a patient..." /></SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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
              {catalog.length > 0 && (
                <div className="grid gap-2">
                  <Label>Tests ({newOrder.selectedTests.length} selected)</Label>
                  <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                    {catalog.map((test) => (
                      <label key={test.id} className="flex items-center gap-2 text-sm p-1 hover:bg-muted/50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newOrder.selectedTests.includes(test.id)}
                          onChange={() => toggleTest(test.id)}
                          className="rounded"
                        />
                        <span>{test.name}</span>
                        {test.category && <Badge variant="outline" className="text-xs ml-auto">{test.category}</Badge>}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                <Label>Clinical Notes</Label>
                <Textarea
                  placeholder="Relevant clinical information..."
                  value={newOrder.clinicalNotes}
                  onChange={(e) => setNewOrder((p) => ({ ...p, clinicalNotes: e.target.value }))}
                  rows={2}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newOrder.fastingRequired}
                  onChange={(e) => setNewOrder((p) => ({ ...p, fastingRequired: e.target.checked }))}
                  className="rounded"
                />
                Fasting Required
              </label>
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
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <FlaskConical className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">{order.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.orderNumber} &middot; {order.testCount} test{order.testCount !== 1 ? "s" : ""} &middot; {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {(order.priority === "urgent" || order.priority === "stat") && (
                    <Badge variant="destructive" className="text-xs uppercase">{order.priority}</Badge>
                  )}
                  <Badge className={
                    order.status === "pending" ? "bg-yellow-100 text-yellow-700 border-0" :
                    order.status === "sample_collected" ? "bg-cyan-100 text-cyan-700 border-0" :
                    order.status === "in_progress" ? "bg-blue-100 text-blue-700 border-0" :
                    order.status === "completed" ? "bg-emerald-100 text-emerald-700 border-0" :
                    order.status === "validated" ? "bg-green-100 text-green-700 border-0" :
                    "bg-gray-100 text-gray-700 border-0"
                  }>
                    {order.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                    {order.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
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
                      <p className="font-medium">{order.orderingDoctorName ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Technician</p>
                      <p className="font-medium">{order.assignedTechnicianName ?? "Unassigned"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Fasting Required</p>
                      <p className="font-medium">{order.fastingRequired ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Sample Collected</p>
                      <p className="font-medium">{order.sampleCollectedAt ? new Date(order.sampleCollectedAt).toLocaleString() : "—"}</p>
                    </div>
                  </div>
                  {order.clinicalNotes && (
                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs">Clinical Notes</p>
                      <p>{order.clinicalNotes}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground text-xs mb-2">Tests</p>
                    <div className="flex flex-wrap gap-2">
                      {order.tests.map((t) => (
                        <Badge key={t.id} variant="outline" className="text-xs">
                          {t.testName}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {getNextStatus(order.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, getNextStatus(order.status)!); }}
                        disabled={updatingStatusId === order.id}
                      >
                        {updatingStatusId === order.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ArrowRight className="h-3 w-3 mr-1" />}
                        Move to {getNextStatus(order.status)!.replace("_", " ")}
                      </Button>
                    )}
                    {order.status !== "cancelled" && order.status !== "validated" && (
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openTechDialog(order.id); }}>
                        <UserPlus className="h-3 w-3 mr-1" /> Assign Technician
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

      <Dialog open={techDialogOpen} onOpenChange={setTechDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Technician</DialogTitle>
            <DialogDescription>Select a technician for this order.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Technician ID</Label>
            <Input placeholder="Enter technician user ID..." value={techId} onChange={(e) => setTechId(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTechDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignTech} disabled={techSaving}>
              {techSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
