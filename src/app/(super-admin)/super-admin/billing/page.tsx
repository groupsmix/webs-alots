"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, TrendingUp, AlertTriangle, CheckCircle, Clock,
  Send, Eye, Search, Filter, CreditCard, Receipt, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
import { logger } from "@/lib/logger";
  fetchBillingRecords,
  type BillingRecord,
} from "@/lib/super-admin-actions";

type StatusFilter = "all" | "paid" | "pending" | "overdue" | "cancelled";

export default function BillingPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [detailRecord, setDetailRecord] = useState<BillingRecord | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderRecord, setReminderRecord] = useState<BillingRecord | null>(null);
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = useCallback(async () => {
    try {
      const data = await fetchBillingRecords();
      setRecords(data);
    } catch (err) {
      logger.warn("Operation failed", { context: "page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const paidRecords = records.filter((r) => r.status === "paid");
  const overdueRecords = records.filter((r) => r.status === "overdue");
  const mrr = records.filter((r) => r.status !== "cancelled").reduce((sum, r) => sum + r.amountDue, 0);
  const arr = mrr * 12;
  const overdueCount = overdueRecords.length;
  const paidCount = paidRecords.length;
  const totalRevenue = paidRecords.reduce((sum, r) => sum + r.amountPaid, 0);
  const overdueAmount = overdueRecords.reduce((sum, r) => sum + r.amountDue - r.amountPaid, 0);

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.clinicName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
    return matchSearch && (statusFilter === "all" || r.status === statusFilter);
  });

  function handleSendReminder() {
    setReminderOpen(false);
    setReminderRecord(null);
  }

  function handleMarkPaid(record: BillingRecord) {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === record.id ? { ...r, status: "paid" as const, amountPaid: r.amountDue, paidDate: new Date().toISOString().split("T")[0] } : r
      )
    );
    setDetailRecord(null);
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "paid": return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
      case "pending": return <Clock className="h-3.5 w-3.5 text-yellow-600" />;
      case "overdue": return <AlertTriangle className="h-3.5 w-3.5 text-red-600" />;
      default: return <Clock className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Billing Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor revenue, subscriptions, and payment status</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading billing data...
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">MRR</span>
            </div>
            <p className="text-2xl font-bold">{mrr.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">MAD / month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">ARR</span>
            </div>
            <p className="text-2xl font-bold">{arr.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">MAD / year</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Collected</span>
            </div>
            <p className="text-2xl font-bold">{totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{paidCount} invoices paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-muted-foreground">Overdue</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{overdueAmount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{overdueCount} invoices overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by clinic or invoice ID..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(["all", "paid", "pending", "overdue", "cancelled"] as StatusFilter[]).map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)} className="capitalize text-xs">
              {s === "all" ? "All" : s}
            </Button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Invoices ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-3 px-4">Invoice</th>
                  <th className="text-left font-medium py-3 px-4">Clinic</th>
                  <th className="text-left font-medium py-3 px-4 hidden md:table-cell">Plan</th>
                  <th className="text-left font-medium py-3 px-4">Amount</th>
                  <th className="text-left font-medium py-3 px-4 hidden md:table-cell">Due Date</th>
                  <th className="text-left font-medium py-3 px-4">Status</th>
                  <th className="text-right font-medium py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <tr key={record.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <p className="font-mono text-xs">{record.id}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{record.dueDate}</p>
                    </td>
                    <td className="py-3 px-4 font-medium">{record.clinicName}</td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <Badge variant="outline" className="capitalize">{record.plan}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{record.amountDue.toLocaleString()} {record.currency}</p>
                      {record.amountPaid > 0 && record.amountPaid < record.amountDue && (
                        <p className="text-xs text-muted-foreground">Paid: {record.amountPaid.toLocaleString()}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">{record.dueDate}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {statusIcon(record.status)}
                        <Badge variant={record.status === "paid" ? "success" : record.status === "overdue" ? "destructive" : record.status === "pending" ? "warning" : "secondary"} className="capitalize">
                          {record.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" title="View details" onClick={() => setDetailRecord(record)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {record.status === "overdue" && (
                          <Button variant="ghost" size="sm" title="Send reminder" className="text-orange-600" onClick={() => { setReminderRecord(record); setReminderOpen(true); }}>
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No invoices found.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Detail Dialog */}
      <Dialog open={detailRecord !== null} onOpenChange={() => setDetailRecord(null)}>
        {detailRecord && (
          <DialogContent onClose={() => setDetailRecord(null)} className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Invoice {detailRecord.id}</DialogTitle>
              <DialogDescription>Invoice details for {detailRecord.clinicName}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Clinic:</span> <span className="font-medium">{detailRecord.clinicName}</span></div>
                <div><span className="text-muted-foreground">Plan:</span> <Badge variant="outline" className="capitalize ml-1">{detailRecord.plan}</Badge></div>
                <div><span className="text-muted-foreground">Amount Due:</span> <span className="font-medium">{detailRecord.amountDue.toLocaleString()} {detailRecord.currency}</span></div>
                <div><span className="text-muted-foreground">Amount Paid:</span> <span className="font-medium">{detailRecord.amountPaid.toLocaleString()} {detailRecord.currency}</span></div>
                <div><span className="text-muted-foreground">Invoice Date:</span> <span>{detailRecord.invoiceDate}</span></div>
                <div><span className="text-muted-foreground">Due Date:</span> <span>{detailRecord.dueDate}</span></div>
                {detailRecord.paidDate && <div><span className="text-muted-foreground">Paid Date:</span> <span>{detailRecord.paidDate}</span></div>}
                {detailRecord.paymentMethod && <div><span className="text-muted-foreground">Payment:</span> <span className="capitalize">{detailRecord.paymentMethod}</span></div>}
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <div className="flex items-center gap-1.5">
                  {statusIcon(detailRecord.status)}
                  <Badge variant={detailRecord.status === "paid" ? "success" : detailRecord.status === "overdue" ? "destructive" : "warning"} className="capitalize">{detailRecord.status}</Badge>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailRecord(null)}>Close</Button>
              {detailRecord.status !== "paid" && (
                <Button onClick={() => handleMarkPaid(detailRecord)}>
                  <CreditCard className="h-4 w-4 mr-1" />Mark as Paid
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Send Reminder Dialog */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        {reminderRecord && (
          <DialogContent onClose={() => setReminderOpen(false)}>
            <DialogHeader>
              <DialogTitle>Send Payment Reminder</DialogTitle>
              <DialogDescription>Send an overdue payment reminder to {reminderRecord.clinicName}.</DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
              <p className="text-sm font-medium">{reminderRecord.clinicName}</p>
              <p className="text-xs text-muted-foreground">Invoice: {reminderRecord.id}</p>
              <p className="text-xs text-muted-foreground">Amount: {reminderRecord.amountDue.toLocaleString()} {reminderRecord.currency}</p>
              <p className="text-xs text-red-600">Due: {reminderRecord.dueDate}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReminderOpen(false)}>Cancel</Button>
              <Button onClick={handleSendReminder}><Send className="h-4 w-4 mr-1" />Send Reminder</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
