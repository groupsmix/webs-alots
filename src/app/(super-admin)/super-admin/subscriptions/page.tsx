/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import {
  Search,
  Filter,
  Eye,
  Send,
  CreditCard,
  Receipt,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Stethoscope,
  Crown,
  Pill,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
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
import { systemTypeLabels, tierColors, statusColors } from "@/lib/config/pricing";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import { logger } from "@/lib/logger";
import {
  fetchClientSubscriptions,
  type ClientSubscription,
  type SystemType,
} from "@/lib/super-admin-actions";
import { formatCurrency, formatNumber, getLocalDateStr } from "@/lib/utils";

type StatusFilter = "all" | ClientSubscription["status"];
type SystemFilter = "all" | SystemType;
type SortField = "clinicName" | "amount" | "status" | "tierName" | "lastPayment";

// S15: last paid invoice date for a subscription
function getLastPaymentDate(invoices: ClientSubscription["invoices"]): string {
  const dates = invoices
    .filter((i) => i.status === "paid")
    .map((i) => i.paidDate ?? i.date)
    .sort();
  return dates.at(-1) ?? "—";
}

// S13: derive reason from available data (no dedicated DB field)
function getSuspensionReason(sub: ClientSubscription): string {
  if (sub.status === "cancelled")
    return sub.cancelledAt ? `Annulé le ${sub.cancelledAt}` : "Annulé";
  if (sub.status === "suspended") {
    if (sub.invoices.some((i) => i.status === "overdue")) return "Paiement en retard";
    if (sub.invoices.length === 0) return "Aucune facture enregistrée";
    return "Voir les détails";
  }
  if (sub.status === "past_due") return "Paiement en retard";
  return "";
}

const systemIcons: Record<SystemType, typeof Stethoscope> = {
  doctor: Stethoscope,
  dentist: Crown,
  pharmacy: Pill,
};

export default function SubscriptionsPage() {
  const { addToast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [systemFilter, setSystemFilter] = useState<SystemFilter>("all");
  const [detailSub, setDetailSub] = useState<ClientSubscription | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderSub, setReminderSub] = useState<ClientSubscription | null>(null);
  const [expandedInvoices, setExpandedInvoices] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<ClientSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  // S16/S17: sort + pagination
  const [sortField, setSortField] = useState<SortField>("clinicName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const loadSubscriptions = useCallback(async () => {
    try {
      const data = await fetchClientSubscriptions();
      setSubscriptions(data);
    } catch (err) {
      logger.warn("Failed to load subscriptions page", { context: "page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadSubscriptions();
    return () => {
      controller.abort();
    };
  }, [loadSubscriptions]);

  const stats = {
    active: subscriptions.filter((s) => s.status === "active").length,
    trial: subscriptions.filter((s) => s.status === "trial").length,
    pastDue: subscriptions.filter((s) => s.status === "past_due").length,
    suspended: subscriptions.filter((s) => s.status === "suspended").length,
    cancelled: subscriptions.filter((s) => s.status === "cancelled").length,
    total: subscriptions.length,
  };
  const mrr = subscriptions
    .filter((s) => s.status === "active" || s.status === "past_due")
    .reduce((sum, s) => {
      if (s.billingCycle === "yearly") return sum + Math.round(s.amount / 12);
      return sum + s.amount;
    }, 0);
  const arr = mrr * 12;

  const filtered = subscriptions.filter((sub) => {
    const q = search.toLowerCase();
    const matchSearch = !q || sub.clinicName.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || sub.status === statusFilter;
    const matchSystem = systemFilter === "all" || sub.systemType === systemFilter;
    return matchSearch && matchStatus && matchSystem;
  });

  // S16/S17: sort then paginate
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "clinicName":
        cmp = a.clinicName.localeCompare(b.clinicName, "fr");
        break;
      case "amount":
        cmp = a.amount - b.amount;
        break;
      case "status":
        cmp = a.status.localeCompare(b.status);
        break;
      case "tierName":
        cmp = a.tierName.localeCompare(b.tierName, "fr");
        break;
      case "lastPayment": {
        const la = getLastPaymentDate(a.invoices);
        const lb = getLastPaymentDate(b.invoices);
        cmp =
          la === "—" && lb === "—" ? 0 : la === "—" ? 1 : lb === "—" ? -1 : la.localeCompare(lb);
        break;
      }
    }
    return sortDir === "asc" ? cmp : -cmp;
  });
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE) || 1;
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 whenever filters or sort order change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, systemFilter, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  function SortIndicator({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
    );
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
      case "trial":
        return <Clock className="h-3.5 w-3.5 text-blue-600" />;
      case "past_due":
        return <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />;
      default:
        return <AlertTriangle className="h-3.5 w-3.5 text-red-600" />;
    }
  };

  const statusLabel = (status: ClientSubscription["status"]) => {
    const labels: Record<ClientSubscription["status"], string> = {
      active: "Actif",
      trial: "Essai",
      past_due: "Impayé",
      cancelled: "Annulé",
      suspended: "Suspendu",
    };
    return labels[status];
  };

  function handleExportSubscriptionsCSV() {
    const rows = sorted.map((sub) => ({
      "Nom du client": sub.clinicName,
      Type: systemTypeLabels[sub.systemType],
      Tier: sub.tierName,
      Cycle: sub.billingCycle === "monthly" ? "Mensuel" : "Annuel",
      "Montant (MAD)": sub.amount,
      Devise: sub.currency,
      Statut: statusLabel(sub.status),
      "Dernier paiement": getLastPaymentDate(sub.invoices),
      "Début de période": sub.currentPeriodStart,
      "Fin de période": sub.currentPeriodEnd,
    }));
    exportToCSV(rows, `abonnements-${getLocalDateStr()}.csv`);
    addToast("Export CSV téléchargé", "success");
  }

  function handleExportSubscriptionsPDF() {
    const rows = sorted.map((sub) => ({
      Client: sub.clinicName,
      Type: systemTypeLabels[sub.systemType],
      Tier: sub.tierName,
      "Montant (MAD)": String(sub.amount),
      Statut: statusLabel(sub.status),
      "Dernier pmt": getLastPaymentDate(sub.invoices),
      Période: `${sub.currentPeriodStart} — ${sub.currentPeriodEnd}`,
    }));
    exportToPDF("Abonnements — Oltigo Health", rows, [
      "Client",
      "Type",
      "Tier",
      "Montant (MAD)",
      "Statut",
      "Dernier pmt",
      "Période",
    ]);
    addToast("PDF généré — utilisez Enregistrer en PDF dans la boîte d'impression", "success");
  }

  if (loading) {
    return (
      <div>
        <Breadcrumb
          items={[
            { label: "Super Admin", href: "/super-admin/dashboard" },
            { label: "Subscriptions" },
          ]}
        />
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Gestion des abonnements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi des abonnements clients, facturation et paiements
          </p>
        </div>
        <CardSkeleton count={4} className="mb-6" />
        <TableSkeleton rows={6} columns={7} className="mt-4" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Subscriptions" },
        ]}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestion des abonnements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi des abonnements clients, facturation et paiements
          </p>
        </div>
        {/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-1" />
              Exporter
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportSubscriptionsCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportSubscriptionsPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* eslint-enable i18next/no-literal-string */}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">MRR</span>
            </div>
            <p className="text-2xl font-bold">{formatNumber(mrr)}</p>
            <p className="text-xs text-muted-foreground">MAD / mois</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="h-4 w-4 text-blue-600" />
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
              <span className="text-xs text-muted-foreground">Actifs</span>
            </div>
            <p className="text-2xl font-bold">{stats.active}</p>
            <p className="text-xs text-muted-foreground">{stats.trial} en essai</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-muted-foreground">Problèmes</span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {stats.pastDue + stats.suspended + stats.cancelled}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.pastDue} impayés, {stats.suspended} suspendus, {stats.cancelled} annulés
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom de client..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground mr-1" />
          {(["all", "doctor", "dentist", "pharmacy"] as SystemFilter[]).map((s) => (
            <Button
              key={s}
              variant={systemFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setSystemFilter(s)}
              className="text-xs"
            >
              {s === "all" ? "Tous" : systemTypeLabels[s as SystemType]}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "active", "trial", "past_due", "suspended", "cancelled"] as StatusFilter[]).map(
          (s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="text-xs"
            >
              {s === "all" ? "Tous" : statusLabel(s as ClientSubscription["status"])}
              <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                {s === "all"
                  ? subscriptions.length
                  : subscriptions.filter((sub) => sub.status === s).length}
              </Badge>
            </Button>
          ),
        )}
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Abonnements ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="table-mobile-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-3 px-4">
                    <button
                      onClick={() => handleSort("clinicName")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Client
                      <SortIndicator field="clinicName" />
                    </button>
                  </th>
                  <th className="text-left font-medium py-3 px-4 hidden md:table-cell">Type</th>
                  <th className="text-left font-medium py-3 px-4">
                    <button
                      onClick={() => handleSort("tierName")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Tier
                      <SortIndicator field="tierName" />
                    </button>
                  </th>
                  <th className="text-left font-medium py-3 px-4 hidden lg:table-cell">Cycle</th>
                  <th className="text-left font-medium py-3 px-4">
                    <button
                      onClick={() => handleSort("amount")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Montant
                      <SortIndicator field="amount" />
                    </button>
                  </th>
                  <th className="text-left font-medium py-3 px-4 hidden lg:table-cell">
                    <button
                      onClick={() => handleSort("lastPayment")}
                      className="flex items-center hover:text-foreground transition-colors"
                      title="Date du dernier paiement reçu"
                    >
                      Dernier pmt
                      <SortIndicator field="lastPayment" />
                    </button>
                  </th>
                  <th className="text-left font-medium py-3 px-4">
                    <button
                      onClick={() => handleSort("status")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Statut
                      <SortIndicator field="status" />
                    </button>
                  </th>
                  <th className="text-right font-medium py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((sub) => {
                  const Icon = systemIcons[sub.systemType];
                  const isInvoicesOpen = expandedInvoices === sub.id;
                  const reason = getSuspensionReason(sub);

                  return (
                    <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <p className="font-medium">{sub.clinicName}</p>
                        <p className="text-xs text-muted-foreground md:hidden">
                          {systemTypeLabels[sub.systemType]}
                        </p>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {systemTypeLabels[sub.systemType]}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`text-[10px] ${tierColors[sub.tierSlug]}`}>
                          {sub.tierName}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell text-muted-foreground">
                        {sub.billingCycle === "monthly" ? "Mensuel" : "Annuel"}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {formatCurrency(sub.amount, "fr", sub.currency)}
                      </td>
                      {/* S15: last payment date replaces the period column */}
                      <td className="py-3 px-4 hidden lg:table-cell text-muted-foreground text-xs">
                        {getLastPaymentDate(sub.invoices)}
                      </td>
                      <td className="py-3 px-4">
                        {/* S13: show derived suspension/cancellation reason as tooltip */}
                        <div className="flex items-center gap-1.5">
                          {statusIcon(sub.status)}
                          <Badge
                            className={`text-[10px] ${statusColors[sub.status]} ${reason ? "cursor-help" : ""}`}
                            title={reason || undefined}
                          >
                            {statusLabel(sub.status)}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Détails"
                            onClick={() => setDetailSub(sub)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title={sub.invoices.length > 0 ? "Factures" : "Aucune facture"}
                            disabled={sub.invoices.length === 0}
                            onClick={() => setExpandedInvoices(isInvoicesOpen ? null : sub.id)}
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            {sub.invoices.length > 0 &&
                              (isInvoicesOpen ? (
                                <ChevronUp className="h-3 w-3 ml-0.5" />
                              ) : (
                                <ChevronDown className="h-3 w-3 ml-0.5" />
                              ))}
                          </Button>
                          {(() => {
                            const canRemind =
                              sub.status === "past_due" || sub.status === "suspended";
                            return (
                              <Button
                                variant="ghost"
                                size="sm"
                                title={canRemind ? "Envoyer rappel" : "Rappel indisponible"}
                                disabled={!canRemind}
                                className={canRemind ? "text-orange-600" : undefined}
                                onClick={() => {
                                  setReminderSub(sub);
                                  setReminderOpen(true);
                                }}
                              >
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      Aucun abonnement trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* S16: Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  Page {page} sur {totalPages} — {sorted.length} abonnement
                  {sorted.length !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label="Page précédente"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const n = start + i;
                    if (n > totalPages) return null;
                    return (
                      <Button
                        key={n}
                        variant={n === page ? "default" : "outline"}
                        size="sm"
                        className="w-8 h-8 p-0 text-xs"
                        onClick={() => setPage(n)}
                      >
                        {n}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Page suivante"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Expanded Invoices */}
          {expandedInvoices &&
            (() => {
              const sub = subscriptions.find((s) => s.id === expandedInvoices);
              if (!sub) return null;
              return (
                <div className="border-t bg-muted/30 p-4">
                  <h4 className="text-sm font-semibold mb-3">Factures — {sub.clinicName}</h4>
                  <div className="space-y-2">
                    {sub.invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between rounded-lg border bg-background p-3 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-muted-foreground">{inv.id}</span>
                          <span>{inv.date}</span>
                          <span className="font-medium">{formatCurrency(inv.amount)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              inv.status === "paid"
                                ? "success"
                                : inv.status === "overdue"
                                  ? "destructive"
                                  : inv.status === "refunded"
                                    ? "secondary"
                                    : "warning"
                            }
                          >
                            {inv.status === "paid"
                              ? "Payé"
                              : inv.status === "overdue"
                                ? "Impayé"
                                : inv.status === "refunded"
                                  ? "Remboursé"
                                  : "En attente"}
                          </Badge>
                          <Button variant="ghost" size="sm">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailSub !== null} onOpenChange={() => setDetailSub(null)}>
        {detailSub && (
          <DialogContent onClose={() => setDetailSub(null)} className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{detailSub.clinicName}</DialogTitle>
              <DialogDescription>Détails de l&apos;abonnement</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Type :</span>{" "}
                  <span className="font-medium capitalize">
                    {systemTypeLabels[detailSub.systemType]}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tier :</span>{" "}
                  <Badge className={`text-[10px] ${tierColors[detailSub.tierSlug]}`}>
                    {detailSub.tierName}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Montant :</span>{" "}
                  <span className="font-medium">
                    {formatCurrency(detailSub.amount, "fr", detailSub.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cycle :</span>{" "}
                  <span>{detailSub.billingCycle === "monthly" ? "Mensuel" : "Annuel"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Début :</span>{" "}
                  <span>{detailSub.currentPeriodStart}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fin :</span>{" "}
                  <span>{detailSub.currentPeriodEnd}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Paiement :</span>{" "}
                  <span>{detailSub.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Renouvellement :</span>{" "}
                  <span>{detailSub.autoRenew ? "Automatique" : "Manuel"}</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Statut :</span>
                <div className="flex items-center gap-1.5">
                  {statusIcon(detailSub.status)}
                  <Badge className={`${statusColors[detailSub.status]}`}>
                    {statusLabel(detailSub.status)}
                  </Badge>
                </div>
              </div>
              {detailSub.trialEndsAt && (
                <p className="text-sm text-muted-foreground">
                  Essai se termine le :{" "}
                  <span className="font-medium text-foreground">{detailSub.trialEndsAt}</span>
                </p>
              )}
              {detailSub.cancelledAt && (
                <p className="text-sm text-red-600">Annulé le : {detailSub.cancelledAt}</p>
              )}
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-2">Historique de facturation</h4>
                {detailSub.invoices.length > 0 ? (
                  <div className="space-y-2">
                    {detailSub.invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between text-sm rounded-lg border p-2"
                      >
                        <div>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {inv.id}
                          </span>
                          <span>{inv.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(inv.amount)}</span>
                          <Badge
                            variant={
                              inv.status === "paid"
                                ? "success"
                                : inv.status === "overdue"
                                  ? "destructive"
                                  : "warning"
                            }
                            className="text-[10px]"
                          >
                            {inv.status === "paid"
                              ? "Payé"
                              : inv.status === "overdue"
                                ? "Impayé"
                                : "En attente"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune facture</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailSub(null)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Reminder Dialog */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        {reminderSub && (
          <DialogContent onClose={() => setReminderOpen(false)}>
            <DialogHeader>
              <DialogTitle>Envoyer un rappel de paiement</DialogTitle>
              <DialogDescription>
                Un rappel sera envoyé à {reminderSub.clinicName} pour leur paiement en retard.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
              <p className="text-sm font-medium">{reminderSub.clinicName}</p>
              <p className="text-xs text-muted-foreground">
                Tier: {reminderSub.tierName} —{" "}
                {formatCurrency(reminderSub.amount, "fr", reminderSub.currency)}
              </p>
              <p className="text-xs text-red-600">Statut: {statusLabel(reminderSub.status)}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReminderOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => {
                  setReminderOpen(false);
                  setReminderSub(null);
                }}
              >
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
