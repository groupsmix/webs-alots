"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, History, FlaskConical, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useTenant } from "@/components/tenant-provider";
import { fetchPatients, fetchPatientLabOrders, fetchLabTestResults } from "@/lib/data/client";
import type { PatientView, LabTestOrderView, LabTestResultView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

function FlagBadge({ flag }: { flag: string }) {
  const color =
    flag === "critical_high" || flag === "critical_low" ? "bg-red-100 text-red-700 border-0" :
    flag === "high" ? "bg-orange-100 text-orange-700 border-0" :
    flag === "low" ? "bg-yellow-100 text-yellow-700 border-0" :
    "bg-emerald-100 text-emerald-700 border-0";
  const Icon = flag.includes("high") ? TrendingUp : flag.includes("low") ? TrendingDown : Minus;
  return (
    <Badge className={`${color} text-xs`}>
      <Icon className="h-3 w-3 mr-1" />
      {flag.replace("_", " ")}
    </Badge>
  );
}

export default function PatientHistoryPage() {
  const tenant = useTenant();
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientOrders, setPatientOrders] = useState<LabTestOrderView[]>([]);
  const [selectedOrderResults, setSelectedOrderResults] = useState<LabTestResultView[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchPatients(tenant?.clinicId ?? "")
      .then((d) => { if (!controller.signal.aborted) setPatients(d); })
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, [tenant?.clinicId]);

  useEffect(() => {
    function loadOrders() {
      if (!selectedPatientId) { setPatientOrders([]); return; }
      setOrdersLoading(true);
      setSelectedOrderId(null);
      setSelectedOrderResults([]);
      fetchPatientLabOrders(tenant?.clinicId ?? "", selectedPatientId)
        .then(setPatientOrders)
        .finally(() => setOrdersLoading(false));
    }
    loadOrders();
  }, [selectedPatientId, tenant?.clinicId]);

  useEffect(() => {
    function loadResults() {
      if (!selectedOrderId) { setSelectedOrderResults([]); return; }
      setResultsLoading(true);
      fetchLabTestResults(selectedOrderId)
        .then(setSelectedOrderResults)
        .finally(() => setResultsLoading(false));
    }
    loadResults();
  }, [selectedOrderId]);

  if (loading) {
    return <PageLoader message="Loading patients..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  const filteredPatients = patients.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.phone?.includes(q) ?? false);
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Patient History</h1>
        <p className="text-muted-foreground text-sm">View past lab results by patient</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Patient List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {filteredPatients.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-colors ${
                  selectedPatientId === p.id ? "ring-2 ring-blue-500" : "hover:bg-muted/50"
                }`}
                onClick={() => setSelectedPatientId(p.id)}
              >
                <CardContent className="pt-3 pb-3">
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.phone ?? "No phone"}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Orders & Results */}
        <div className="lg:col-span-3">
          {!selectedPatientId ? (
            <Card>
              <CardContent className="py-16 text-center">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Select a patient to view their lab history</p>
              </CardContent>
            </Card>
          ) : ordersLoading ? (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="animate-pulse text-muted-foreground">Loading orders...</div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <h2 className="font-semibold">Lab Orders ({patientOrders.length})</h2>
              {patientOrders.length === 0 && (
                <p className="text-sm text-muted-foreground">No lab orders found for this patient</p>
              )}
              {patientOrders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="pt-4 pb-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
                    >
                      <div className="flex items-center gap-3">
                        <FlaskConical className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-sm">{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString()} &middot; {order.testCount} tests
                          </p>
                        </div>
                      </div>
                      <Badge className={
                        order.status === "validated" ? "bg-green-100 text-green-700 border-0" :
                        order.status === "completed" ? "bg-emerald-100 text-emerald-700 border-0" :
                        "bg-gray-100 text-gray-700 border-0"
                      }>
                        {order.status.replace("_", " ")}
                      </Badge>
                    </div>

                    {selectedOrderId === order.id && (
                      <div className="mt-4 pt-4 border-t">
                        {resultsLoading ? (
                          <p className="text-sm text-muted-foreground animate-pulse">Loading results...</p>
                        ) : selectedOrderResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No results recorded</p>
                        ) : (
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
                              {selectedOrderResults.map((r) => (
                                <tr key={r.id} className="border-b last:border-0">
                                  <td className="py-2 font-medium">{r.testName}</td>
                                  <td className="py-2">{r.value ?? "—"}</td>
                                  <td className="py-2 text-muted-foreground">{r.unit ?? ""}</td>
                                  <td className="py-2 text-muted-foreground text-xs">
                                    {r.referenceMin != null && r.referenceMax != null
                                      ? `${r.referenceMin} - ${r.referenceMax}`
                                      : "—"}
                                  </td>
                                  <td className="py-2">
                                    {r.flag && <FlagBadge flag={r.flag} />}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
