"use client";

import { Download, CreditCard, Eye, FileText, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import {
  getCurrentUser,
  fetchInvoices,
  type InvoiceView,
} from "@/lib/data/client";

const statusVariant: Record<string, "success" | "warning" | "destructive"> = {
  paid: "success",
  pending: "warning",
  overdue: "destructive",
};

export default function PatientInvoicesPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const invs = await fetchInvoices(user.clinic_id);
      if (controller.signal.aborted) return;
    setInvoices(invs);
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

  if (loading) {
    return <PageLoader message="Loading invoices..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
  const totalPending = invoices.filter((i) => i.status === "pending").reduce((sum, i) => sum + i.amount, 0);

  const handleDownload = (invoiceId: string) => {
    setDownloading(invoiceId);
    setTimeout(() => {
      setDownloading(null);
    }, 1500);
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "Patient", href: "/patient/dashboard" }, { label: "Invoices" }]} />
      <h1 className="text-2xl font-bold mb-6">My Invoices</h1>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="text-lg font-bold">{totalPaid} MAD</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/50">
              <CreditCard className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-bold">{totalPending} MAD</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 lg:col-span-1">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Invoices</p>
              <p className="text-lg font-bold">{invoices.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-3 pr-4">Invoice</th>
                  <th className="text-left font-medium py-3 pr-4">Date</th>
                  <th className="text-left font-medium py-3 pr-4">Patient</th>
                  <th className="text-left font-medium py-3 pr-4">Amount</th>
                  <th className="text-left font-medium py-3 pr-4">Method</th>
                  <th className="text-left font-medium py-3 pr-4">Status</th>
                  <th className="text-right font-medium py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-3 pr-4 font-medium">{inv.id.toUpperCase()}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{inv.date}</td>
                    <td className="py-3 pr-4">{inv.patientName}</td>
                    <td className="py-3 pr-4 font-semibold">{inv.amount} {inv.currency}</td>
                    <td className="py-3 pr-4 capitalize text-muted-foreground">{inv.method}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={statusVariant[inv.status]}>{inv.status}</Badge>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" title="View">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Download Receipt"
                          onClick={() => handleDownload(inv.id)}
                          disabled={downloading === inv.id}
                        >
                          <Download className={`h-3.5 w-3.5 ${downloading === inv.id ? "animate-bounce" : ""}`} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{inv.id.toUpperCase()}</p>
                  <Badge variant={statusVariant[inv.status]}>{inv.status}</Badge>
                </div>
                <p className="text-sm">{inv.patientName}</p>
                <div className="flex items-center justify-between mt-2">
                  <div>
                    <p className="text-sm font-semibold">{inv.amount} {inv.currency}</p>
                    <p className="text-xs text-muted-foreground">{inv.date} &middot; {inv.method}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(inv.id)}
                    disabled={downloading === inv.id}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Receipt
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
