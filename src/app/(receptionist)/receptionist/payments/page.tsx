"use client";

import { useState, useEffect } from "react";
import { CreditCard, Check, Clock, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  getCurrentUser,
  fetchTodayAppointments,
  fetchInvoices,
  type InvoiceView,
} from "@/lib/data/client";
import { PaymentDialog } from "@/components/receptionist/payment-dialog";
import { PageLoader } from "@/components/ui/page-loader";

interface PaymentEntry {
  id: string;
  appointmentId: string;
  patientName: string;
  serviceName: string;
  date: string;
  amount: number;
  method: string;
  status: "paid" | "pending" | "partial";
}

export default function PaymentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) { setLoading(false); return; }
      const clinicId = user.clinic_id;
      const [appts, invoices] = await Promise.all([
        fetchTodayAppointments(clinicId),
        fetchInvoices(clinicId),
      ]);
      if (controller.signal.aborted) return;
      const invoiceByAppt = new Map<string, InvoiceView>();
      for (const inv of invoices) {
        if (inv.appointmentId) invoiceByAppt.set(inv.appointmentId, inv);
      }
      const entries: PaymentEntry[] = appts.map((a) => {
        const inv = invoiceByAppt.get(a.id);
        return {
          id: inv?.id ?? `pay-${a.id}`,
          appointmentId: a.id,
          patientName: a.patientName,
          serviceName: a.serviceName,
          date: a.date,
          amount: inv?.amount ?? 0,
          method: inv?.method ?? "cash",
          status: (inv?.status === "paid" ? "paid" : "pending") as "paid" | "pending",
        };
      });
      setPaymentEntries(entries);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, []);

  const filteredEntries = paymentEntries.filter((e) =>
    e.patientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCollected = paymentEntries.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const totalPending = paymentEntries.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0);
  const paidCount = paymentEntries.filter((e) => e.status === "paid").length;
  const pendingCount = paymentEntries.filter((e) => e.status === "pending").length;

  const handleCollectPayment = (entryId: string, payment: { amount: number; method: string }) => {
    setPaymentEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, status: "paid" as const, amount: payment.amount, method: payment.method } : e
      )
    );
  };

  if (loading) {
    return <PageLoader message="Loading payments..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Payment Collection</h1>
        <PaymentDialog />
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-600">{totalCollected} MAD</p>
            <p className="text-xs text-muted-foreground">Total Collected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{totalPending} MAD</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{paidCount}</p>
            <p className="text-xs text-muted-foreground">Paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by patient name..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Payment List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredEntries.map((entry) => {
              return (
                <div key={entry.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Avatar>
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {entry.patientName.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{entry.patientName}</p>
                    <p className="text-xs text-muted-foreground">{entry.serviceName}</p>
                  </div>
                  <div className="text-right mr-2">
                    <p className="text-sm font-bold">{entry.amount} MAD</p>
                    {entry.status === "paid" && (
                      <p className="text-xs text-muted-foreground capitalize">{entry.method}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.status === "paid" ? (
                      <Badge variant="success" className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Paid
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="warning" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Pending
                        </Badge>
                        <PaymentDialog
                          trigger={
                            <Button size="sm" className="bg-green-600 hover:bg-green-700">
                              <CreditCard className="h-3 w-3 mr-1" />
                              Collect
                            </Button>
                          }
                          patientName={entry.patientName}
                          appointmentId={entry.appointmentId}
                          suggestedAmount={entry.amount}
                          onCollect={(p) => handleCollectPayment(entry.id, p)}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredEntries.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No payment entries found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
