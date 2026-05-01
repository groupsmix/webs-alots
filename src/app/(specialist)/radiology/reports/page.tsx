"use client";

import { Search, FileText, Download, Scan, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-switcher";
import { useTenant } from "@/components/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/page-loader";
import { fetchRadiologyOrders } from "@/lib/data/client";
import type { RadiologyOrderView } from "@/lib/data/client";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { formatCurrency, formatNumber } from "@/lib/utils";

export default function RadiologyReportsPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [locale] = useLocale();

  const tenant = useTenant();
  const [orders, setOrders] = useState<RadiologyOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchRadiologyOrders(tenant?.clinicId ?? "")
      .then((all) => setOrders(all.filter((o) => o.status === "reported" || o.status === "validated")))
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, [tenant?.clinicId]);

  const handleGeneratePdf = async (order: RadiologyOrderView) => {
    setGeneratingPdf(order.id);
    try {
      const res = await fetch("/api/radiology/report-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          clinicId: tenant?.clinicId ?? "",
          patientName: order.patientName,
          modality: order.modality,
          bodyPart: order.bodyPart,
          findings: order.findings,
          impression: order.impression,
          reportText: order.reportText,
          radiologistName: order.radiologistName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pdfUrl) {
          window.open(data.pdfUrl, "_blank");
          // Refresh to get updated pdfUrl
          fetchRadiologyOrders(tenant?.clinicId ?? "")
            .then((all) => setOrders(all.filter((o) => o.status === "reported" || o.status === "validated")));
        }
      }
    } finally {
      setGeneratingPdf(null);
    }
  };

  if (loading) {
    return <PageLoader message="Loading reports..." />;
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
    return o.patientName.toLowerCase().includes(q) || o.orderNumber.toLowerCase().includes(q) || o.modality.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Radiology Reports</h1>
          <p className="text-muted-foreground text-sm">Completed radiology reports</p>
        </div>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by patient, order, modality..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-3">
        {filtered.map((order) => (
          <Card key={order.id}>
            <CardContent className="pt-4 pb-4">
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- keyboard interaction handled by parent or child interactive element */}
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium">{order.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.modality.toUpperCase()} &middot; {order.bodyPart ?? "N/A"} &middot; {order.reportedAt ? new Date(order.reportedAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={order.status === "validated" ? "bg-green-100 text-green-700 border-0" : "bg-emerald-100 text-emerald-700 border-0"}>
                    {order.status}
                  </Badge>
                  {order.pdfUrl ? (
                    <a
                      href={order.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="h-3 w-3 mr-1" /> PDF
                    </a>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); handleGeneratePdf(order); }}
                      disabled={generatingPdf === order.id}
                    >
                      {generatingPdf === order.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                      Generate PDF
                    </Button>
                  )}
                </div>
              </div>

              {expandedId === order.id && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  {order.findings && (
                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs font-medium mb-1">Findings</p>
                      <p className="whitespace-pre-wrap">{order.findings}</p>
                    </div>
                  )}
                  {order.impression && (
                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs font-medium mb-1">Impression</p>
                      <p className="font-medium whitespace-pre-wrap">{order.impression}</p>
                    </div>
                  )}
                  {order.reportText && (
                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs font-medium mb-1">Full Report</p>
                      <p className="whitespace-pre-wrap">{order.reportText}</p>
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    <p>Radiologist: {order.radiologistName ?? "\u2014"} &middot; Reported: {order.reportedAt ? new Date(order.reportedAt).toLocaleString() : "\u2014"}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Scan className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No reports found</p>
          </div>
        )}
      </div>
    </div>
  );
}
