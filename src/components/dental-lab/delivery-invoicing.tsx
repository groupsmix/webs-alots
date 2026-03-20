"use client";

import { useState } from "react";
import { Truck, FileText, Plus, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LabInvoiceStatus, DeliveryCondition } from "@/lib/types/database";

interface DeliveryView {
  id: string;
  orderType: string;
  deliveryDate: string;
  deliveredBy: string | null;
  receivedBy: string | null;
  condition: DeliveryCondition;
  dentistName: string | null;
  notes: string | null;
}

interface InvoiceView {
  id: string;
  invoiceNumber: string;
  dentistName: string | null;
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  status: LabInvoiceStatus;
  issuedDate: string;
  dueDate: string | null;
  paidDate: string | null;
}

const INVOICE_STATUS_CONFIG: Record<LabInvoiceStatus, { variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" }> = {
  draft: { variant: "secondary" },
  sent: { variant: "default" },
  paid: { variant: "success" },
  overdue: { variant: "destructive" },
  cancelled: { variant: "outline" },
};

const CONDITION_CONFIG: Record<DeliveryCondition, { variant: "success" | "destructive" | "warning" }> = {
  good: { variant: "success" },
  damaged: { variant: "destructive" },
  incomplete: { variant: "warning" },
};

interface DeliveryInvoicingProps {
  deliveries: DeliveryView[];
  invoices: InvoiceView[];
  editable?: boolean;
  onAddInvoice?: (invoice: { invoiceNumber: string; dentistName: string; items: string; dueDate: string; notes: string }) => void;
  onUpdateInvoiceStatus?: (invoiceId: string, status: LabInvoiceStatus) => void;
}

export function DeliveryInvoicing({ deliveries, invoices, editable = false, onAddInvoice, onUpdateInvoiceStatus }: DeliveryInvoicingProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ invoiceNumber: "", dentistName: "", items: "", dueDate: "", notes: "" });
  const [activeTab, setActiveTab] = useState<"deliveries" | "invoices">("invoices");

  const handleAdd = () => {
    if (form.invoiceNumber.trim() && onAddInvoice) {
      onAddInvoice(form);
      setForm({ invoiceNumber: "", dentistName: "", items: "", dueDate: "", notes: "" });
      setShowForm(false);
    }
  };

  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const pendingAmount = invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold">{deliveries.length}</p>
            <p className="text-xs text-muted-foreground">Deliveries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold">{invoices.length}</p>
            <p className="text-xs text-muted-foreground">Invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-green-600">{totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Revenue (MAD)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-orange-600">{pendingAmount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Pending (MAD)</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b pb-2">
        <Button size="sm" variant={activeTab === "invoices" ? "default" : "ghost"} onClick={() => setActiveTab("invoices")}>
          <FileText className="h-4 w-4 mr-1" /> Invoices
        </Button>
        <Button size="sm" variant={activeTab === "deliveries" ? "default" : "ghost"} onClick={() => setActiveTab("deliveries")}>
          <Truck className="h-4 w-4 mr-1" /> Deliveries
        </Button>
        {editable && activeTab === "invoices" && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" /> New Invoice
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">New Invoice</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Invoice Number</Label>
                <Input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="INV-001" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Dentist</Label>
                <Input value={form.dentistName} onChange={(e) => setForm({ ...form, dentistName: e.target.value })} placeholder="Dr. Name" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Items (one per line: description | qty | price)</Label>
              <Textarea value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} placeholder="Crown Zirconia | 2 | 1500&#10;Bridge PFM | 1 | 2000" className="text-sm" rows={3} />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." className="text-sm" rows={1} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>Create Invoice</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices Tab */}
      {activeTab === "invoices" && (
        <div className="space-y-2">
          {invoices.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No invoices yet.</p>
              </CardContent>
            </Card>
          ) : (
            invoices.map((invoice) => {
              const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== "paid" && invoice.status !== "cancelled";
              return (
                <Card key={invoice.id} className={isOverdue ? "border-red-300" : ""}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                          <Badge variant={INVOICE_STATUS_CONFIG[invoice.status].variant} className="text-xs">{invoice.status}</Badge>
                          {isOverdue && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Overdue</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {invoice.dentistName && <span>Dr. {invoice.dentistName}</span>}
                          <span>Issued: {invoice.issuedDate}</span>
                          {invoice.dueDate && <span>Due: {invoice.dueDate}</span>}
                          {invoice.paidDate && <span className="text-green-600">Paid: {invoice.paidDate}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-bold">{invoice.total.toLocaleString()} {invoice.currency}</p>
                          {invoice.taxAmount > 0 && <p className="text-[10px] text-muted-foreground">Tax: {invoice.taxAmount.toLocaleString()}</p>}
                        </div>
                        {editable && invoice.status === "draft" && (
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onUpdateInvoiceStatus?.(invoice.id, "sent")}>Send</Button>
                        )}
                        {editable && invoice.status === "sent" && (
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onUpdateInvoiceStatus?.(invoice.id, "paid")}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Mark Paid
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Deliveries Tab */}
      {activeTab === "deliveries" && (
        <div className="space-y-2">
          {deliveries.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Truck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No deliveries recorded.</p>
              </CardContent>
            </Card>
          ) : (
            deliveries.map((delivery) => (
              <Card key={delivery.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{delivery.orderType}</p>
                        <Badge variant={CONDITION_CONFIG[delivery.condition].variant} className="text-[10px]">{delivery.condition}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {delivery.deliveryDate}</span>
                        {delivery.dentistName && <span>To: Dr. {delivery.dentistName}</span>}
                        {delivery.deliveredBy && <span>By: {delivery.deliveredBy}</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
