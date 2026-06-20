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
  X,
  Loader2,
  Stethoscope,
  Crown,
  Pill,
  FileSpreadsheet,
  FileText,
  FlaskConical,
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

// S18: Heuristic detection of test/junk account names.
// Flags names that look auto-generated or typed carelessly:
//   - single repeated character  (FFFFFFFF, aaaaaaa)
//   - very short (≤ 3 chars)
//   - no vowels in a name ≥ 6 chars  (sdqsdqsdq, jgjjrjrj)
//   - all digits
//   - contains test/demo/temp/junk/lorem keywords
function isTestAccount(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (/^(.)\1{2,}$/.test(n)) return true; // repeated single char
  if (n.length <= 3) return true;
  if (/^\d+$/.test(n)) return true;
  if (n.length >= 6 && !/[aeiouAEIOU]/u.test(n)) return true;
  if (/\b(test|demo|temp|junk|lorem|fake|dummy|sample)\b/i.test(n)) return true;
  return false;
}

const systemIcons: Record<SystemType, typeof Stethoscope> = {
  doctor: Stethoscope,
  dentist: Crown,
  pharmacy: Pill,
};

// S17: SortIndicator must live outside SubscriptionsPage so it is not
// re-created on every render (react-hooks/static-components rule).
function SortIndicator({
  field,
  sortField,
  sortDir,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: "asc" | "desc";
}) {
  if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
  return sortDir === "asc" ? (
    <ChevronUp className="h-3 w-3 ml-1" />
  ) : (
    <ChevronDown className="h-3 w-3 ml-1" />
  );
}

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
  // S3: export loading feedback
  const [isExporting, setIsExporting] = useState(false);
  // S16/S17: sort + pagination
  const [sortField, setSortField] = useState<SortField>("clinicName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // S11/S14: bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<
    "activate" | "suspend" | "cancel" | null
  >(null);

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

  // S11/S14: bulk-select helpers
  const pagedIds = paged.map((s) => s.id);
  const allPageSelected = pagedIds.length > 0 && pagedIds.every((id) => selectedIds.has(id));
  const somePageSelected = !allPageSelected && pagedIds.some((id) => selectedIds.has(id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pagedIds.forEach((id) => next.delete(id));
      else pagedIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleSelectRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function executeBulkAction(action: "activate" | "suspend" | "cancel") {
    const ids = [...selectedIds];
    const newStatus: ClientSubscription["status"] =
      action === "activate" ? "active" : action === "suspend" ? "suspended" : "cancelled";
    setSubscriptions((prev) =>
      prev.map((s) => (ids.includes(s.id) ? { ...s, status: newStatus } : s)),
    );
    setSelectedIds(new Set());
    setBulkConfirmOpen(false);
    setPendingBulkAction(null);
    const past = action === "activate" ? "activés" : action === "suspend" ? "suspendus" : "annulés";
    addToast(
      `${ids.length} abonnement${ids.length > 1 ? "s" : ""} ${past}`,
      action === "cancel" ? "error" : "success",
    );
  }

  function handleBulkExport() {
    const rows = subscriptions
      .filter((s) => selectedIds.has(s.id))
      .map((sub) => ({
        "Nom du client": sub.clinicName,
        Type: systemTypeLabels[sub.systemType],
        Tier: sub.tierName,
        Cycle: sub.billingCycle === "monthly" ? "Mensuel" : "Annuel",
        "Montant (MAD)": sub.amount,
        Devise: sub.currency,
        Statut: statusLabel(sub.status),
        "Dernier paiement": getLastPaymentDate(sub.invoices),
      }));
    exportToCSV(rows, `selection-abonnements-${getLocalDateStr()}.csv`);
    addToast(
      `${rows.length} abonnement${rows.length > 1 ? "s" : ""} exporté${rows.length > 1 ? "s" : ""}`,
      "success",
    );
  }

  // Clear selection when visible page changes or filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, statusFilter, systemFilter, search]);

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

  async function handleExportSubscriptionsCSV() {
    setIsExporting(true);
    await new Promise((r) => setTimeout(r, 50));
    try {
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
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportSubscriptionsPDF() {
    setIsExporting(true);
    await new Promise((r) => setTimeout(r, 50));
    try {
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
    } finally {
      setIsExporting(false);
    }
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
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Gestion des abonnements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi des abonnements clients, facturation et paiements
          </p>
        </div>

        {/* S12: indeterminate progress bar replaces the silent skeleton-only wait.
            Gives the admin clear feedback that data is being fetched, and avoids
            the "page looks broken" impression reported in the June QA. */}
        <div
          role="progressbar"
          aria-label="Chargement des abonnements"
          aria-busy="true"
          className="relative h-1 w-full overflow-hidden rounded-full bg-primary/15 mb-6"
        >
          <div
            className="absolute inset-y-0 left-0 w-[40%] rounded-full bg-primary"
            style={{
              animation: "sa-indeterminate 1.4s cubic-bezier(0.65,0.05,0.36,0.95) infinite",
            }}
          />
          <style>{`
            @keyframes sa-indeterminate {
              0%   { transform: translateX(-100%); }
              100% { transform: translateX(350%); }
            }
          `}</style>
        </div>

        <p className="text-xs text-muted-foreground mb-4 animate-pulse">
          Récupération des abonnements…
        </p>
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
            <DropdownMenuItem onClick={handleExportSubscriptionsCSV} disabled={isExporting}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportSubscriptionsPDF} disabled={isExporting}>
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

      {/* S11/S14: Bulk action bar — visible only when rows are selected */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 mb-4">
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleBulkExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exporter CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-green-700 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
            onClick={() => {
              setPendingBulkAction("activate");
              setBulkConfirmOpen(true);
            }}
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
            Activer
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-orange-700 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
            onClick={() => {
              setPendingBulkAction("suspend");
              setBulkConfirmOpen(true);
            }}
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            Suspendre
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-700 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => {
              setPendingBulkAction("cancel");
              setBulkConfirmOpen(true);
            }}
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Annuler abonnement
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setSelectedIds(new Set())}
            aria-label="Désélectionner tout"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

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
                  {/* S11: select-all checkbox */}
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      aria-label="Sélectionner la page"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = somePageSelected;
                      }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 cursor-pointer accent-primary"
                    />
                  </th>
                  <th className="text-left font-medium py-3 px-4">
                    <button
                      onClick={() => handleSort("clinicName")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Client
                      <SortIndicator field="clinicName" sortField={sortField} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="text-left font-medium py-3 px-4 hidden md:table-cell">Type</th>
                  <th className="text-left font-medium py-3 px-4">
                    <button
                      onClick={() => handleSort("tierName")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Tier
                      <SortIndicator field="tierName" sortField={sortField} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="text-left font-medium py-3 px-4 hidden lg:table-cell">Cycle</th>
                  <th className="text-left font-medium py-3 px-4">
                    <button
                      onClick={() => handleSort("amount")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Montant
                      <SortIndicator field="amount" sortField={sortField} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="text-left font-medium py-3 px-4 hidden lg:table-cell">
                    <button
                      onClick={() => handleSort("lastPayment")}
                      className="flex items-center hover:text-foreground transition-colors"
                      title="Date du dernier paiement reçu"
                    >
                      Dernier pmt
                      <SortIndicator field="lastPayment" sortField={sortField} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="text-left font-medium py-3 px-4">
                    <button
                      onClick={() => handleSort("status")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Statut
                      <SortIndicator field="status" sortField={sortField} sortDir={sortDir} />
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
                    <tr
                      key={sub.id}
                      className={`border-b last:border-0 hover:bg-muted/50 ${selectedIds.has(sub.id) ? "bg-primary/5" : ""}`}
                    >
                      {/* S11: row checkbox */}
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          aria-label={`Sélectionner ${sub.clinicName}`}
                          checked={selectedIds.has(sub.id)}
                          onChange={() => toggleSelectRow(sub.id)}
                          className="h-4 w-4 cursor-pointer accent-primary"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium">{sub.clinicName}</p>
                          {/* S18: test-account indicator */}
                          {isTestAccount(sub.clinicName) && (
                            <span
                              title="Nom détecté comme compte test — vérifiez avant toute action"
                              className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            >
                              <FlaskConical className="h-2.5 w-2.5" />
                              Test
                            </span>
                          )}
                        </div>
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
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
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
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* S19: financial summary strip -------------------------------- */}
              {(() => {
                const paid = detailSub.invoices.filter((i) => i.status === "paid");
                const totalPaid = paid.reduce((s, i) => s + i.amount, 0);
                const lastPmt = paid
                  .map((i) => i.paidDate ?? i.date)
                  .sort()
                  .at(-1);
                return totalPaid > 0 ? (
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-center">
                    <div>
                      <p className="text-base font-bold text-green-600">
                        {formatCurrency(totalPaid, "fr", detailSub.currency)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Total encaissé</p>
                    </div>
                    <div>
                      <p className="text-base font-bold">{paid.length}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Paiement{paid.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold tabular-nums">{lastPmt ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">Dernier pmt</p>
                    </div>
                  </div>
                ) : null;
              })()}

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

              {/* S19: synthesised activity timeline ----------------------- */}
              {(() => {
                type TlEvent = {
                  date: string;
                  label: string;
                  sub?: string;
                  dot: string; // tailwind bg + text classes
                  glyph: string;
                };
                const events: TlEvent[] = [];

                // Period start
                events.push({
                  date: detailSub.currentPeriodStart,
                  label: "Période en cours démarrée",
                  dot: "bg-blue-100 text-blue-600 dark:bg-blue-900/40",
                  glyph: "▶",
                });

                // Invoice events (sorted ascending)
                const sorted = [...detailSub.invoices].sort((a, b) => a.date.localeCompare(b.date));
                for (const inv of sorted) {
                  if (inv.status === "paid") {
                    events.push({
                      date: inv.paidDate ?? inv.date,
                      label: `Paiement reçu — ${formatCurrency(inv.amount, "fr", detailSub.currency)}`,
                      sub: `Facture ${inv.id.slice(-6).toUpperCase()}`,
                      dot: "bg-green-100 text-green-700 dark:bg-green-900/40",
                      glyph: "✓",
                    });
                  } else if (inv.status === "overdue") {
                    events.push({
                      date: inv.date,
                      label: `Facture impayée — ${formatCurrency(inv.amount, "fr", detailSub.currency)}`,
                      sub: `Facture ${inv.id.slice(-6).toUpperCase()}`,
                      dot: "bg-red-100 text-red-600 dark:bg-red-900/40",
                      glyph: "!",
                    });
                  } else {
                    events.push({
                      date: inv.date,
                      label: `Facture en attente — ${formatCurrency(inv.amount, "fr", detailSub.currency)}`,
                      sub: `Facture ${inv.id.slice(-6).toUpperCase()}`,
                      dot: "bg-amber-100 text-amber-600 dark:bg-amber-900/40",
                      glyph: "·",
                    });
                  }
                }

                // Status events
                if (detailSub.cancelledAt) {
                  events.push({
                    date: detailSub.cancelledAt,
                    label: "Abonnement annulé",
                    dot: "bg-red-100 text-red-600 dark:bg-red-900/40",
                    glyph: "✕",
                  });
                }
                if (detailSub.status === "suspended" && !detailSub.cancelledAt) {
                  const reason = getSuspensionReason(detailSub);
                  events.push({
                    date: detailSub.currentPeriodEnd,
                    label: "Abonnement suspendu",
                    sub: reason || undefined,
                    dot: "bg-orange-100 text-orange-600 dark:bg-orange-900/40",
                    glyph: "⏸",
                  });
                }
                if (detailSub.trialEndsAt) {
                  events.push({
                    date: detailSub.trialEndsAt,
                    label: "Fin de période d'essai",
                    dot: "bg-sky-100 text-sky-600 dark:bg-sky-900/40",
                    glyph: "◷",
                  });
                }

                if (events.length < 2) return null; // nothing useful to show

                events.sort((a, b) => a.date.localeCompare(b.date));

                return (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Activité</h4>
                      <ol className="ml-2 border-l border-border space-y-3">
                        {events.map((evt, i) => (
                          <li key={i} className="ml-4 relative">
                            <span
                              className={`absolute -left-[1.375rem] flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none ${evt.dot}`}
                            >
                              {evt.glyph}
                            </span>
                            <p className="text-xs font-medium leading-tight">{evt.label}</p>
                            {evt.sub && (
                              <p className="text-[10px] text-muted-foreground">{evt.sub}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground tabular-nums">
                              {evt.date}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </>
                );
              })()}
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
      {/* S11/S14: Bulk action confirmation dialog */}
      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent onClose={() => setBulkConfirmOpen(false)}>
          <DialogHeader>
            <DialogTitle>Confirmer l&apos;action groupée</DialogTitle>
            <DialogDescription>
              {selectedIds.size} abonnement{selectedIds.size > 1 ? "s" : ""} seront{" "}
              {pendingBulkAction === "activate"
                ? "réactivés"
                : pendingBulkAction === "suspend"
                  ? "suspendus"
                  : "annulés définitivement"}
              . Cette opération est réversible sauf annulation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkConfirmOpen(false);
                setPendingBulkAction(null);
              }}
            >
              Retour
            </Button>
            <Button
              variant={pendingBulkAction === "cancel" ? "destructive" : "default"}
              onClick={() => pendingBulkAction && executeBulkAction(pendingBulkAction)}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
