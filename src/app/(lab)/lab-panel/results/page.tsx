"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, FlaskConical, ArrowUpDown, TrendingUp, TrendingDown, Minus, Plus, Loader2, FileText } from "lucide-react";
import { useTenant } from "@/components/tenant-provider";
import { fetchLabTestOrders, fetchLabTestResults, saveLabTestResult } from "@/lib/data/client";
import type { LabTestOrderView, LabTestResultView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

function FlagIcon({ flag }: { flag: string }) {
  if (flag === "high" || flag === "critical_high") return <TrendingUp className="h-3 w-3" />;
  if (flag === "low" || flag === "critical_low") return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

function flagColor(flag: string): string {
  if (flag === "critical_high" || flag === "critical_low") return "bg-red-100 text-red-700 border-0";
  if (flag === "high") return "bg-orange-100 text-orange-700 border-0";
  if (flag === "low") return "bg-yellow-100 text-yellow-700 border-0";
  return "bg-emerald-100 text-emerald-700 border-0";
}

export default function ResultsPage() {
  const tenant = useTenant();
  const [orders, setOrders] = useState<LabTestOrderView[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [results, setResults] = useState<LabTestResultView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Result entry dialog
  const [entryOpen, setEntryOpen] = useState(false);
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryForm, setEntryForm] = useState({
    testItemId: "",
    parameterName: "",
    value: "",
    unit: "",
    referenceMin: "",
    referenceMax: "",
    flag: "normal",
    notes: "",
  });

  const [pdfGenerating, setPdfGenerating] = useState(false);

  const refreshResults = useCallback(() => {
    if (!selectedOrderId) return;
    setResultsLoading(true);
    fetchLabTestResults(selectedOrderId)
      .then(setResults)
      .finally(() => setResultsLoading(false));
  }, [selectedOrderId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLabTestOrders(tenant?.clinicId ?? "")
      .then((all) => {
      if (controller.signal.aborted) return;
        const active = all.filter((o) => o.status !== "cancelled");
        setOrders(active);
      })
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, [tenant?.clinicId]);

  useEffect(() => {
    if (!selectedOrderId) {
      setResults([]);
      return;
    }
    setResultsLoading(true);
    fetchLabTestResults(selectedOrderId)
      .then(setResults)
      .finally(() => setResultsLoading(false));
  }, [selectedOrderId]);

  const handleAddResult = async () => {
    if (!selectedOrderId || !entryForm.parameterName || !entryForm.value) return;
    setEntrySaving(true);
    try {
      await saveLabTestResult({
        order_id: selectedOrderId,
        test_item_id: entryForm.testItemId || selectedOrderId,
        parameter_name: entryForm.parameterName,
        value: entryForm.value,
        unit: entryForm.unit || undefined,
        reference_min: entryForm.referenceMin ? parseFloat(entryForm.referenceMin) : undefined,
        reference_max: entryForm.referenceMax ? parseFloat(entryForm.referenceMax) : undefined,
        flag: entryForm.flag || "normal",
        notes: entryForm.notes || undefined,
      });
      setEntryOpen(false);
      setEntryForm({ testItemId: "", parameterName: "", value: "", unit: "", referenceMin: "", referenceMax: "", flag: "normal", notes: "" });
      refreshResults();
    } finally {
      setEntrySaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!selectedOrderId) return;
    const order = orders.find((o) => o.id === selectedOrderId);
    if (!order) return;
    setPdfGenerating(true);
    try {
      const res = await fetch("/api/lab/report-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrderId,
          clinicId: tenant?.clinicId ?? "",
          patientName: order.patientName,
          orderNumber: order.orderNumber,
          results: results.map((r) => ({
            testName: r.testName,
            value: r.value,
            unit: r.unit,
            referenceMin: r.referenceMin,
            referenceMax: r.referenceMax,
            flag: r.flag,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pdfUrl) window.open(data.pdfUrl, "_blank");
      }
    } finally {
      setPdfGenerating(false);
    }
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  if (loading) {
    return <PageLoader message="Loading..." />;
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
    if (!search) return true;
    const q = search.toLowerCase();
    return o.patientName.toLowerCase().includes(q) || o.orderNumber.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Results Entry</h1>
        <p className="text-muted-foreground text-sm">Select an order to view or enter results</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {filtered.map((order) => (
              <Card
                key={order.id}
                className={`cursor-pointer transition-colors ${
                  selectedOrderId === order.id ? "ring-2 ring-blue-500" : "hover:bg-muted/50"
                }`}
                onClick={() => setSelectedOrderId(order.id)}
              >
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{order.patientName}</p>
                      <p className="text-xs text-muted-foreground">{order.orderNumber}</p>
                    </div>
                    <Badge className={
                      order.status === "completed" ? "bg-emerald-100 text-emerald-700 border-0" :
                      order.status === "validated" ? "bg-green-100 text-green-700 border-0" :
                      order.status === "in_progress" ? "bg-blue-100 text-blue-700 border-0" :
                      "bg-yellow-100 text-yellow-700 border-0"
                    }>
                      {order.status.replace("_", " ")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No orders found</p>
            )}
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          {!selectedOrderId ? (
            <Card>
              <CardContent className="py-16 text-center">
                <FlaskConical className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Select an order to view results</p>
              </CardContent>
            </Card>
          ) : resultsLoading ? (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="animate-pulse text-muted-foreground">Loading results...</div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    Test Results
                  </h2>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{results.length} result{results.length !== 1 ? "s" : ""}</Badge>
                    <Button size="sm" variant="outline" onClick={() => setEntryOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" /> Add Result
                    </Button>
                    {results.length > 0 && (
                      <Button size="sm" variant="outline" onClick={handleGeneratePdf} disabled={pdfGenerating}>
                        {pdfGenerating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
                        Generate PDF
                      </Button>
                    )}
                  </div>
                </div>

                {results.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No results recorded yet for this order</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium">Test</th>
                          <th className="pb-2 font-medium">Value</th>
                          <th className="pb-2 font-medium">Unit</th>
                          <th className="pb-2 font-medium">Reference</th>
                          <th className="pb-2 font-medium">Flag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r) => (
                          <tr key={r.id} className="border-b last:border-0">
                            <td className="py-2 font-medium">{r.testName}</td>
                            <td className="py-2">{r.value ?? "—"}</td>
                            <td className="py-2 text-muted-foreground">{r.unit ?? ""}</td>
                            <td className="py-2 text-muted-foreground text-xs">
                              {r.referenceMin != null && r.referenceMax != null
                                ? `${r.referenceMin} - ${r.referenceMax}`
                                : r.referenceMin != null
                                ? `>= ${r.referenceMin}`
                                : r.referenceMax != null
                                ? `<= ${r.referenceMax}`
                                : "—"}
                            </td>
                            <td className="py-2">
                              {r.flag && (
                                <Badge className={`${flagColor(r.flag)} text-xs`}>
                                  <FlagIcon flag={r.flag} />
                                  <span className="ml-1 capitalize">{r.flag.replace("_", " ")}</span>
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Result Entry Dialog */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Test Result</DialogTitle>
            <DialogDescription>
              Enter a test result for {selectedOrder?.patientName ?? "this order"}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedOrder && selectedOrder.tests.length > 0 && (
              <div className="grid gap-2">
                <Label>Test</Label>
                <Select value={entryForm.testItemId} onValueChange={(v) => setEntryForm((p) => ({ ...p, testItemId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select test..." /></SelectTrigger>
                  <SelectContent>
                    {selectedOrder.tests.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.testName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Parameter Name</Label>
              <Input placeholder="e.g., Glucose, Hemoglobin..." value={entryForm.parameterName} onChange={(e) => setEntryForm((p) => ({ ...p, parameterName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Value</Label>
                <Input placeholder="e.g., 5.2" value={entryForm.value} onChange={(e) => setEntryForm((p) => ({ ...p, value: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Unit</Label>
                <Input placeholder="e.g., g/dL" value={entryForm.unit} onChange={(e) => setEntryForm((p) => ({ ...p, unit: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Reference Min</Label>
                <Input type="number" placeholder="Min" value={entryForm.referenceMin} onChange={(e) => setEntryForm((p) => ({ ...p, referenceMin: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Reference Max</Label>
                <Input type="number" placeholder="Max" value={entryForm.referenceMax} onChange={(e) => setEntryForm((p) => ({ ...p, referenceMax: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Flag</Label>
              <Select value={entryForm.flag} onValueChange={(v) => setEntryForm((p) => ({ ...p, flag: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical_low">Critical Low</SelectItem>
                  <SelectItem value="critical_high">Critical High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Notes (optional)</Label>
              <Input placeholder="Additional notes..." value={entryForm.notes} onChange={(e) => setEntryForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryOpen(false)}>Cancel</Button>
            <Button onClick={handleAddResult} disabled={entrySaving || !entryForm.parameterName || !entryForm.value}>
              {entrySaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
