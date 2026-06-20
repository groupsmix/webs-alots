/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Send,
  Eye,
  Search,
  Filter,
  CreditCard,
  Receipt,
  Download,
  ChevronDown,
  Calendar,
  X,
  Loader2,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading-skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import { logger } from "@/lib/logger";
import { fetchBillingRecords, type BillingRecord } from "@/lib/super-admin-actions";
import { formatCurrency, formatNumber, getLocalDateStr } from "@/lib/utils";

type StatusFilter = "all" | "paid" | "pending" | "overdue" | "cancelled";

export default function BillingPage() {
  const { addToast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [detailRecord, setDetailRecord] = useState<BillingRecord | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderRecord, setReminderRecord] = useState<BillingRecord | null>(null);
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  // S3: export loading feedback
  const [isExporting, setIsExporting] = useState(false);
  // S2: date range filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadRecords = useCallback(async () => {
    try {
      const data = await fetchBillingRecords();
      setRecords(data);
    } catch (err) {
      logger.warn("Failed to load super-admin billing", { context: "page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadRecords();
    return () => {
      controller.abort();
    };
  }, [loadRecords]);

  // Derive a human-readable invoice number from the payment UUID + invoice date.
  // The raw UUID stays available via tooltip/detail for support lookups.
  const formatInvoiceNumber = (id: string, invoiceDate: string) => {
    const datePart = (invoiceDate ?? "").slice(0, 7); // YYYY-MM
    const suffix = id.replace(/-/g, "").slice(-6).toUpperCase();
    return datePart ? `INV-${datePart}-${suffix}` : `INV-${suffix}`;
  };

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.clinicName.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      formatInvoiceNumber(r.id, r.invoiceDate).toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    // S2: date range — compare ISO date strings (YYYY-MM-DD) lexicographically
    const matchFrom = !dateFrom || r.invoiceDate >= dateFrom;
    const matchTo = !dateTo || r.invoiceDate <= dateTo;
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  // KPI figures reflect the active filters/search so the cards stay in sync
  // with the invoice table below.
  const paidRecords = filtered.filter((r) => r.status === "paid");
  const overdueRecords = filtered.filter((r) => r.status === "overdue");
  const mrr = filtered
    .filter((r) => r.status !== "cancelled")
    .reduce((sum, r) => sum + r.amountDue, 0);
  const arr = mrr * 12;
  const overdueCount = overdueRecords.length;
  const paidCount = paidRecords.length;
  const totalRevenue = paidRecords.reduce((sum, r) => sum + r.amountPaid, 0);
  const overdueAmount = overdueRecords.reduce((sum, r) => sum + r.amountDue - r.amountPaid, 0);

  const isFilteredView =
    statusFilter !== "all" || search.trim().length > 0 || !!dateFrom || !!dateTo;

  // S5: Aggregate paid revenue by month for the trend sparkbar.
  // Always uses the full `records` set (not `filtered`) so the chart
  // shows the true historical trend regardless of the active filter.
  const chartData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    for (const r of records) {
      if (r.status === "paid" && r.amountPaid > 0) {
        const month = r.invoiceDate.slice(0, 7); // YYYY-MM
        byMonth[month] = (byMonth[month] ?? 0) + r.amountPaid;
      }
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // cap at 12 months so the chart stays readable
      .map(([month, amount]) => ({
        label: month.slice(5) + "/" + month.slice(2, 4), // "MM/YY"
        amount,
      }));
  }, [records]);

  async function handleExportBillingCSV() {
    setIsExporting(true);
    // yield to React so the spinner renders before the synchronous CSV work
    await new Promise((r) => setTimeout(r, 50));
    try {
      const rows = filtered.map((r) => ({
        Facture: r.id,
        Clinique: r.clinicName,
        Plan: r.plan,
        "Montant dû (MAD)": r.amountDue,
        "Montant payé (MAD)": r.amountPaid,
        Devise: r.currency,
        Statut: billingStatusLabel(r.status),
        "Date facture": r.invoiceDate,
        "Date d'échéance": r.dueDate,
        "Date de paiement": r.paidDate ?? "",
        "Mode de paiement": r.paymentMethod ?? "",
      }));
      exportToCSV(rows, `billing-${getLocalDateStr()}.csv`);
      addToast("Export CSV téléchargé", "success");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportBillingPDF() {
    setIsExporting(true);
    await new Promise((r) => setTimeout(r, 50));
    try {
      const rows = filtered.map((r) => ({
        Facture: r.id,
        Clinique: r.clinicName,
        Plan: r.plan,
        "Montant dû": formatCurrency(r.amountDue, "fr", r.currency),
        Statut: billingStatusLabel(r.status),
        "Date d'échéance": r.dueDate,
      }));
      exportToPDF("Rapport de facturation — Oltigo Health", rows, [
        "Facture",
        "Clinique",
        "Plan",
        "Montant dû",
        "Statut",
        "Date d'échéance",
      ]);
      addToast("PDF généré — utilisez Enregistrer en PDF dans la boîte d'impression", "success");
    } finally {
      setIsExporting(false);
    }
  }

  // S4: per-row invoice PDF download
  function handleDownloadInvoicePDF(record: BillingRecord) {
    const rows = [
      {
        Facture: formatInvoiceNumber(record.id, record.invoiceDate),
        Client: record.clinicName,
        Plan: record.plan,
        "Montant dû": formatCurrency(record.amountDue, "fr", record.currency),
        "Montant payé": formatCurrency(record.amountPaid, "fr", record.currency),
        Statut: record.status,
        "Date facture": record.invoiceDate,
        "Date échéance": record.dueDate,
        ...(record.paidDate ? { "Date paiement": record.paidDate } : {}),
        ...(record.paymentMethod ? { Paiement: record.paymentMethod } : {}),
      },
    ];
    exportToPDF(
      `Facture ${formatInvoiceNumber(record.id, record.invoiceDate)} — ${record.clinicName}`,
      rows,
      [
        "Facture",
        "Client",
        "Plan",
        "Montant dû",
        "Montant payé",
        "Statut",
        "Date facture",
        "Date échéance",
      ],
    );
    addToast(
      `PDF de la facture ${formatInvoiceNumber(record.id, record.invoiceDate)} généré — utilisez Enregistrer en PDF`,
      "success",
    );
  }

  function handleSendReminder() {
    addToast(`Rappel de paiement envoyé à ${reminderRecord?.clinicName}`, "success");
    setReminderOpen(false);
    setReminderRecord(null);
  }

  function handleMarkPaid(record: BillingRecord) {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === record.id
          ? {
              ...r,
              status: "paid" as const,
              amountPaid: r.amountDue,
              paidDate: getLocalDateStr(),
            }
          : r,
      ),
    );
    setDetailRecord(null);
    addToast(
      `Facture ${formatInvoiceNumber(record.id, record.invoiceDate)} marquée comme payée`,
      "success",
    );
  }

  const billingStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      paid: "Payé",
      pending: "En attente",
      overdue: "Impayé",
      cancelled: "Annulé",
    };
    return map[status] ?? status;
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
      case "pending":
        return <Clock className="h-3.5 w-3.5 text-yellow-600" />;
      case "overdue":
        return <AlertTriangle className="h-3.5 w-3.5 text-red-600" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Facturation" }]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestion de la facturation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi des revenus, abonnements et statuts de paiement
          </p>
        </div>
        {/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={filtered.length === 0 || isExporting}
              aria-label={isExporting ? "Export en cours…" : "Exporter"}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              {isExporting ? "Export…" : "Exporter"}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportBillingCSV} disabled={isExporting}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportBillingPDF} disabled={isExporting}>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* eslint-enable i18next/no-literal-string */}
      </div>

      {loading && (
        <>
          <CardSkeleton count={4} className="mb-6" />
          <TableSkeleton rows={6} columns={7} className="mt-4" />
        </>
      )}

      {!loading && (
        <>
          {/* KPI Cards */}
          <p className="text-xs text-muted-foreground mb-2">
            {isFilteredView
              ? `Vue filtrée — ${filtered.length} facture${filtered.length !== 1 ? "s" : ""} correspondant aux filtres`
              : "Affichage de toutes les factures"}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">MRR</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(mrr)}</p>
                <p className="text-xs text-muted-foreground">MAD / mois</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">ARR</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(arr)}</p>
                <p className="text-xs text-muted-foreground">MAD / an</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">Collecté</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">{paidCount} factures payées</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-xs text-muted-foreground">Impayés</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{formatNumber(overdueAmount)}</p>
                <p className="text-xs text-muted-foreground">{overdueCount} factures impayées</p>
              </CardContent>
            </Card>
          </div>

          {/* S5: Monthly paid-revenue bar chart — always shows all-time trend
              regardless of the active filter so admins keep the big picture
              in view while drilling into specific invoices. Hidden when no
              paid invoices exist yet (chartData.length === 0). */}
          {chartData.length > 0 && (
            <Card className="mb-6">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Revenus encaissés par mois
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {chartData.length} mois · toutes factures
                </span>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                    barCategoryGap="30%"
                  >
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                      }
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        formatCurrency(value, "fr", "MAD"),
                        "Encaissé",
                      ]}
                      labelStyle={{ fontSize: 11 }}
                      contentStyle={{ fontSize: 11 }}
                      cursor={{ fill: "hsl(var(--muted))" }}
                    />
                    <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            index === chartData.length - 1
                              ? "hsl(var(--primary))"
                              : "hsl(var(--primary) / 0.45)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Search, Status Filters, and Date Range */}
          <div className="flex flex-col sm:flex-row gap-3 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par clinique ou numéro de facture..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {(["all", "paid", "pending", "overdue", "cancelled"] as StatusFilter[]).map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                  className="text-xs"
                >
                  {s === "all" ? "Tous" : billingStatusLabel(s)}
                </Button>
              ))}
            </div>
          </div>
          {/* S2: Date range filter row */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Période :</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo || undefined}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Date de début"
            />
            <span className="text-muted-foreground text-xs">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Date de fin"
            />
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                title="Effacer les dates"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Effacer
              </Button>
            )}
          </div>

          {/* Invoices Table */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Factures ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="table-mobile-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium py-3 px-4">Facture</th>
                      <th className="text-left font-medium py-3 px-4">Clinique</th>
                      <th className="text-left font-medium py-3 px-4 hidden md:table-cell">Plan</th>
                      <th className="text-left font-medium py-3 px-4">Montant</th>
                      <th className="text-left font-medium py-3 px-4 hidden md:table-cell">
                        Échéance
                      </th>
                      <th className="text-left font-medium py-3 px-4">Statut</th>
                      <th className="text-right font-medium py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((record) => (
                      <tr key={record.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <p className="font-mono text-xs" title={record.id}>
                            {formatInvoiceNumber(record.id, record.invoiceDate)}
                          </p>
                          <p className="text-xs text-muted-foreground md:hidden">
                            {record.dueDate}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-medium">{record.clinicName}</td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <Badge variant="outline" className="capitalize">
                            {record.plan}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium">
                            {formatCurrency(record.amountDue, "fr", record.currency)}
                          </p>
                          {record.amountPaid > 0 && record.amountPaid < record.amountDue && (
                            <p className="text-xs text-muted-foreground">
                              Payé : {formatCurrency(record.amountPaid, "fr", record.currency)}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">
                          {record.dueDate}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            {statusIcon(record.status)}
                            <Badge
                              variant={
                                record.status === "paid"
                                  ? "success"
                                  : record.status === "overdue"
                                    ? "destructive"
                                    : record.status === "pending"
                                      ? "warning"
                                      : "secondary"
                              }
                              className="capitalize"
                            >
                              {billingStatusLabel(record.status)}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="View details"
                              onClick={() => setDetailRecord(record)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {/* S4: per-row invoice PDF download */}
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Télécharger PDF"
                              onClick={() => handleDownloadInvoicePDF(record)}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            {record.status === "overdue" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Send reminder"
                                className="text-orange-600"
                                onClick={() => {
                                  setReminderRecord(record);
                                  setReminderOpen(true);
                                }}
                              >
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                          Aucune facture trouvée.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Invoice Detail Dialog */}
      <Dialog open={detailRecord !== null} onOpenChange={() => setDetailRecord(null)}>
        {detailRecord && (
          <DialogContent onClose={() => setDetailRecord(null)} className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Invoice {formatInvoiceNumber(detailRecord.id, detailRecord.invoiceDate)}
              </DialogTitle>
              <DialogDescription>
                Détails de la facture pour {detailRecord.clinicName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <span className="text-muted-foreground">Référence :</span>{" "}
                  <span className="font-mono text-xs break-all">{detailRecord.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Clinique :</span>{" "}
                  <span className="font-medium">{detailRecord.clinicName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Plan :</span>{" "}
                  <Badge variant="outline" className="capitalize ml-1">
                    {detailRecord.plan}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Montant dû :</span>{" "}
                  <span className="font-medium">
                    {formatCurrency(detailRecord.amountDue, "fr", detailRecord.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Montant payé :</span>{" "}
                  <span className="font-medium">
                    {formatCurrency(detailRecord.amountPaid, "fr", detailRecord.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date de facture :</span>{" "}
                  <span>{detailRecord.invoiceDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date d&apos;échéance :</span>{" "}
                  <span>{detailRecord.dueDate}</span>
                </div>
                {detailRecord.paidDate && (
                  <div>
                    <span className="text-muted-foreground">Date de paiement :</span>{" "}
                    <span>{detailRecord.paidDate}</span>
                  </div>
                )}
                {detailRecord.paymentMethod && (
                  <div>
                    <span className="text-muted-foreground">Mode de paiement :</span>{" "}
                    <span className="capitalize">{detailRecord.paymentMethod}</span>
                  </div>
                )}
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Statut :</span>
                <div className="flex items-center gap-1.5">
                  {statusIcon(detailRecord.status)}
                  <Badge
                    variant={
                      detailRecord.status === "paid"
                        ? "success"
                        : detailRecord.status === "overdue"
                          ? "destructive"
                          : "warning"
                    }
                    className="capitalize"
                  >
                    {billingStatusLabel(detailRecord.status)}
                  </Badge>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailRecord(null)}>
                Fermer
              </Button>
              {detailRecord.status !== "paid" && (
                <Button onClick={() => handleMarkPaid(detailRecord)}>
                  <CreditCard className="h-4 w-4 mr-1" />
                  Marquer comme payé
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
              <DialogTitle>Envoyer un rappel de paiement</DialogTitle>
              <DialogDescription>
                Un rappel de paiement en retard sera envoyé à {reminderRecord.clinicName}.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
              <p className="text-sm font-medium">{reminderRecord.clinicName}</p>
              <p className="text-xs text-muted-foreground" title={reminderRecord.id}>
                Facture : {formatInvoiceNumber(reminderRecord.id, reminderRecord.invoiceDate)}
              </p>
              <p className="text-xs text-muted-foreground">
                Montant : {formatCurrency(reminderRecord.amountDue, "fr", reminderRecord.currency)}
              </p>
              <p className="text-xs text-red-600">Échéance : {reminderRecord.dueDate}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReminderOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSendReminder}>
                <Send className="h-4 w-4 mr-1" />
                Envoyer le rappel
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
