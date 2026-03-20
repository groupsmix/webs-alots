"use client";

import { useState } from "react";
import { Package, Plus, Clock, CheckCircle, Truck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProstheticOrderType, ProstheticOrderStatus, ProstheticPriority } from "@/lib/types/database";

interface OrderView {
  id: string;
  dentistName: string | null;
  dentistClinic: string | null;
  patientName: string | null;
  orderType: ProstheticOrderType;
  material: string | null;
  shade: string | null;
  toothNumbers: number[];
  description: string | null;
  specialInstructions: string | null;
  status: ProstheticOrderStatus;
  priority: ProstheticPriority;
  receivedDate: string;
  dueDate: string | null;
  completedDate: string | null;
  deliveredDate: string | null;
  price: number | null;
  isPaid: boolean;
}

const STATUS_FLOW: ProstheticOrderStatus[] = ["received", "in_progress", "quality_check", "ready", "delivered"];

const STATUS_CONFIG: Record<ProstheticOrderStatus, { color: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" }> = {
  received: { color: "text-blue-600", variant: "default" },
  in_progress: { color: "text-orange-600", variant: "warning" },
  quality_check: { color: "text-purple-600", variant: "secondary" },
  ready: { color: "text-green-600", variant: "success" },
  delivered: { color: "text-gray-600", variant: "outline" },
  returned: { color: "text-red-600", variant: "destructive" },
};

const ORDER_TYPE_LABELS: Record<ProstheticOrderType, string> = {
  crown: "Crown",
  bridge: "Bridge",
  denture: "Denture",
  implant_abutment: "Implant Abutment",
  veneer: "Veneer",
  inlay_onlay: "Inlay/Onlay",
  orthodontic: "Orthodontic",
  other: "Other",
};

const PRIORITY_VARIANTS: Record<ProstheticPriority, "default" | "warning" | "destructive"> = {
  normal: "default",
  urgent: "warning",
  rush: "destructive",
};

interface ProstheticOrdersProps {
  orders: OrderView[];
  editable?: boolean;
  onAdd?: (order: { dentistName: string; patientName: string; orderType: ProstheticOrderType; material: string; shade: string; toothNumbers: string; dueDate: string; price: string; priority: ProstheticPriority; specialInstructions: string }) => void;
  onAdvanceStatus?: (orderId: string, newStatus: ProstheticOrderStatus) => void;
}

export function ProstheticOrders({ orders, editable = false, onAdd, onAdvanceStatus }: ProstheticOrdersProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    dentistName: "", patientName: "", orderType: "crown" as ProstheticOrderType,
    material: "", shade: "", toothNumbers: "", dueDate: "",
    price: "", priority: "normal" as ProstheticPriority, specialInstructions: "",
  });

  const handleAdd = () => {
    if (onAdd) {
      onAdd(form);
      setForm({ dentistName: "", patientName: "", orderType: "crown", material: "", shade: "", toothNumbers: "", dueDate: "", price: "", priority: "normal", specialInstructions: "" });
      setShowForm(false);
    }
  };

  const getNextStatus = (current: ProstheticOrderStatus): ProstheticOrderStatus | null => {
    const idx = STATUS_FLOW.indexOf(current);
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  const pendingCount = orders.filter((o) => o.status !== "delivered" && o.status !== "returned").length;
  const overdueCount = orders.filter((o) => o.dueDate && new Date(o.dueDate) < new Date() && o.status !== "delivered" && o.status !== "returned").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Prosthetic Orders
          <Badge variant="secondary" className="ml-1">{pendingCount} pending</Badge>
          {overdueCount > 0 && <Badge variant="destructive" className="ml-1">{overdueCount} overdue</Badge>}
        </h2>
        {editable && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            New Order
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">New Prosthetic Order</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Dentist Name</Label>
                <Input value={form.dentistName} onChange={(e) => setForm({ ...form, dentistName: e.target.value })} placeholder="Dr. Name" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Patient Name</Label>
                <Input value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} placeholder="Patient" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Order Type</Label>
                <select value={form.orderType} onChange={(e) => setForm({ ...form, orderType: e.target.value as ProstheticOrderType })} className="w-full rounded-md border px-3 py-2 text-sm">
                  {Object.entries(ORDER_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Material</Label>
                <Input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="Zirconia" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Shade</Label>
                <Input value={form.shade} onChange={(e) => setForm({ ...form, shade: e.target.value })} placeholder="A2" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Tooth #s</Label>
                <Input value={form.toothNumbers} onChange={(e) => setForm({ ...form, toothNumbers: e.target.value })} placeholder="11, 12" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as ProstheticPriority })} className="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="rush">Rush</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Price (MAD)</Label>
                <Input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Special Instructions</Label>
              <Textarea value={form.specialInstructions} onChange={(e) => setForm({ ...form, specialInstructions: e.target.value })} placeholder="Special requests..." className="text-sm" rows={2} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>Create Order</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No prosthetic orders.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const config = STATUS_CONFIG[order.status];
            const nextStatus = getNextStatus(order.status);
            const isOverdue = order.dueDate && new Date(order.dueDate) < new Date() && order.status !== "delivered" && order.status !== "returned";

            return (
              <Card key={order.id} className={isOverdue ? "border-red-300" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{ORDER_TYPE_LABELS[order.orderType]}</p>
                        {order.material && <Badge variant="outline" className="text-[10px]">{order.material}</Badge>}
                        {order.shade && <Badge variant="outline" className="text-[10px]">Shade: {order.shade}</Badge>}
                        {order.toothNumbers.length > 0 && (
                          <Badge variant="outline" className="text-[10px]">#{order.toothNumbers.join(", ")}</Badge>
                        )}
                        <Badge variant={PRIORITY_VARIANTS[order.priority]} className="text-[10px]">{order.priority}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {order.dentistName && <span>Dr. {order.dentistName}</span>}
                        {order.patientName && <span>Patient: {order.patientName}</span>}
                        <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {order.receivedDate}</span>
                        {order.dueDate && (
                          <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                            {isOverdue && <AlertTriangle className="h-3 w-3 inline mr-0.5" />}
                            Due: {order.dueDate}
                          </span>
                        )}
                        {order.price !== null && (
                          <span className="font-medium">
                            {order.price.toLocaleString()} MAD
                            {order.isPaid ? <CheckCircle className="h-3 w-3 inline ml-0.5 text-green-600" /> : ""}
                          </span>
                        )}
                      </div>
                      {order.specialInstructions && (
                        <p className="text-[10px] text-muted-foreground mt-1 italic">{order.specialInstructions}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {/* Status progress */}
                      <div className="flex items-center gap-0.5">
                        {STATUS_FLOW.map((s, idx) => {
                          const currentIdx = STATUS_FLOW.indexOf(order.status);
                          const isPast = idx <= currentIdx;
                          return (
                            <div key={s} className={`h-1.5 w-4 rounded-full ${isPast ? "bg-primary" : "bg-muted"}`} title={s} />
                          );
                        })}
                      </div>
                      <Badge variant={config.variant} className="text-xs whitespace-nowrap">{order.status.replace("_", " ")}</Badge>
                      {editable && nextStatus && (
                        <Button size="sm" variant="outline" className="text-xs h-7 whitespace-nowrap" onClick={() => onAdvanceStatus?.(order.id, nextStatus)}>
                          {nextStatus === "delivered" ? <Truck className="h-3 w-3 mr-1" /> : null}
                          {nextStatus.replace("_", " ")}
                        </Button>
                      )}
                      {editable && order.status === "delivered" && !order.isPaid && (
                        <Badge variant="warning" className="text-[10px]">Unpaid</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
