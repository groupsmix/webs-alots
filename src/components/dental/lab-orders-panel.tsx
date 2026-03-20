"use client";

import { useState } from "react";
import { FlaskConical, Plus, Clock, CheckCircle, Truck, Package, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LabOrder } from "@/lib/dental-demo-data";

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; variant: "default" | "secondary" | "success" | "destructive" | "outline" | "warning" }> = {
  pending: { icon: Clock, color: "text-gray-500", variant: "outline" },
  sent: { icon: Send, color: "text-blue-500", variant: "default" },
  in_progress: { icon: FlaskConical, color: "text-purple-500", variant: "secondary" },
  ready: { icon: CheckCircle, color: "text-green-500", variant: "success" },
  delivered: { icon: Truck, color: "text-emerald-600", variant: "success" },
};

interface LabOrdersPanelProps {
  orders: LabOrder[];
  editable?: boolean;
  onUpdateStatus?: (orderId: string, status: LabOrder["status"]) => void;
  onAddOrder?: (order: Omit<LabOrder, "id" | "createdAt" | "updatedAt">) => void;
}

export function LabOrdersPanel({ orders, editable = false, onUpdateStatus, onAddOrder }: LabOrdersPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newOrder, setNewOrder] = useState({
    labName: "",
    description: "",
    dueDate: "",
    notes: "",
    patientName: "",
  });

  const handleAdd = () => {
    if (newOrder.description.trim() && onAddOrder) {
      onAddOrder({
        patientId: "p1",
        patientName: newOrder.patientName || "Patient",
        doctorId: "d1",
        doctorName: "Dr. Ahmed Benali",
        labName: newOrder.labName,
        description: newOrder.description,
        status: "pending",
        dueDate: newOrder.dueDate || null,
        notes: newOrder.notes,
      });
      setNewOrder({ labName: "", description: "", dueDate: "", notes: "", patientName: "" });
      setShowAddForm(false);
    }
  };

  const statusOrder: LabOrder["status"][] = ["pending", "sent", "in_progress", "ready", "delivered"];

  const getNextStatus = (current: LabOrder["status"]): LabOrder["status"] | null => {
    const idx = statusOrder.indexOf(current);
    return idx < statusOrder.length - 1 ? statusOrder[idx + 1] : null;
  };

  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-4 w-4 mr-1" />
            New Lab Order
          </Button>
        </div>
      )}

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">New Lab Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Patient Name</Label>
                <Input
                  value={newOrder.patientName}
                  onChange={(e) => setNewOrder({ ...newOrder, patientName: e.target.value })}
                  placeholder="Patient name"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Lab Name</Label>
                <Input
                  value={newOrder.labName}
                  onChange={(e) => setNewOrder({ ...newOrder, labName: e.target.value })}
                  placeholder="DentaLab Casablanca"
                  className="text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={newOrder.description}
                onChange={(e) => setNewOrder({ ...newOrder, description: e.target.value })}
                placeholder="Crown, bridge, study models..."
                className="text-sm"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Due Date</Label>
                <Input
                  type="date"
                  value={newOrder.dueDate}
                  onChange={(e) => setNewOrder({ ...newOrder, dueDate: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Input
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                  placeholder="Special instructions"
                  className="text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>Create Order</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No lab orders yet.</p>
          </CardContent>
        </Card>
      ) : (
        orders.map((order) => {
          const config = STATUS_CONFIG[order.status];
          const StatusIcon = config.icon;
          const nextStatus = getNextStatus(order.status);

          return (
            <Card key={order.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${config.color}`}>
                    <StatusIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium">{order.description}</p>
                      <Badge variant={config.variant} className="text-xs shrink-0">
                        {order.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Patient: {order.patientName} &middot; Lab: {order.labName}</p>
                      {order.dueDate && <p>Due: {order.dueDate}</p>}
                      {order.notes && <p className="italic">{order.notes}</p>}
                    </div>
                  </div>
                </div>
                {editable && nextStatus && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateStatus?.(order.id, nextStatus)}
                    >
                      Mark as {nextStatus.replace("_", " ")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
