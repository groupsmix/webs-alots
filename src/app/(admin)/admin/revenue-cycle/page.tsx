"use client";

/**
 * Revenue Cycle Management (RCM) Dashboard — Track 5
 *
 * Unified view of the clinic's revenue cycle:
 *   - Insurance claims pipeline (CNSS, CNOPS, AMO, RAMED)
 *   - Outstanding invoices and collection rate
 *   - Payment plan health
 *   - Revenue by period
 *
 * All amounts in MAD (Moroccan Dirham).
 */

import {
  DollarSign,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Plus,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";

interface InsuranceClaim {
  id: string;
  claim_number: string;
  patient_id: string;
  insurance_type: "CNSS" | "CNOPS" | "AMO" | "RAMED";
  status: "draft" | "submitted" | "approved" | "rejected" | "paid";
  amount_claimed: number;
  amount_approved: number | null;
  amount_paid: number | null;
  created_at: string;
  notes: string | null;
}

interface Invoice {
  id: string;
  invoice_number?: string;
  patient_id?: string;
  status: string;
  total_amount: number;
  amount_paid: number;
  due_date?: string;
  created_at: string;
}

const CLAIM_STATUS_CONFIG: Record<
  InsuranceClaim["status"],
  {
    label: string;
    variant: "default" | "success" | "warning" | "destructive" | "outline";
    icon: typeof CheckCircle;
  }
> = {
  draft: { label: "Brouillon", variant: "outline", icon: Clock },
  submitted: { label: "Soumise", variant: "default", icon: FileText },
  approved: { label: "Approuvée", variant: "warning", icon: CheckCircle },
  rejected: { label: "Refusée", variant: "destructive", icon: AlertCircle },
  paid: { label: "Payée", variant: "success", icon: CheckCircle },
};

const INSURANCE_COLORS: Record<string, string> = {
  CNSS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CNOPS: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  AMO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  RAMED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

function formatMAD(amount: number) {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "text-primary",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: typeof DollarSign;
  trend?: "up" | "down" | "neutral";
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`rounded-xl p-2.5 bg-muted ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 mt-3 text-xs font-medium ${
              trend === "up"
                ? "text-green-600"
                : trend === "down"
                  ? "text-red-500"
                  : "text-muted-foreground"
            }`}
          >
            <TrendingUp className={`h-3 w-3 ${trend === "down" ? "rotate-180" : ""}`} />
            <span>{trend === "up" ? "En hausse" : trend === "down" ? "En baisse" : "Stable"}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RevenueCyclePage() {
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [claimsRes, invoicesRes] = await Promise.all([
        fetch("/api/clinic-owner/insurance-claims?limit=50", { credentials: "include" }),
        fetch("/api/invoices?limit=50", { credentials: "include" }),
      ]);

      if (!claimsRes.ok) throw new Error("Échec du chargement des réclamations");

      const claimsData = await claimsRes.json();
      setClaims(claimsData.data?.claims ?? []);

      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        setInvoices(invoicesData.data?.invoices ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        loadData();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [loadData]);

  if (loading) return <PageLoader message="Chargement du cycle de revenus..." />;

  // KPI calculations
  const totalClaimed = claims.reduce((s, c) => s + c.amount_claimed, 0);
  const totalApproved = claims.reduce((s, c) => s + (c.amount_approved ?? 0), 0);
  const totalPaid = claims.reduce((s, c) => s + (c.amount_paid ?? 0), 0);
  const pendingClaims = claims.filter((c) => c.status === "submitted" || c.status === "approved");
  const rejectedClaims = claims.filter((c) => c.status === "rejected");

  const outstandingInvoices = invoices.filter(
    (i) => i.status === "pending" || i.status === "overdue",
  );
  const outstandingAmount = outstandingInvoices.reduce(
    (s, i) => s + (i.total_amount - i.amount_paid),
    0,
  );
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");

  const collectionRate = totalClaimed > 0 ? Math.round((totalPaid / totalClaimed) * 100) : 0;

  // Filter claims
  const filteredClaims =
    statusFilter === "all" ? claims : claims.filter((c) => c.status === statusFilter);

  // Group claims by insurance type
  const claimsByType: Record<string, { count: number; amount: number }> = {};
  for (const claim of claims) {
    if (!claimsByType[claim.insurance_type]) {
      claimsByType[claim.insurance_type] = { count: 0, amount: 0 };
    }
    claimsByType[claim.insurance_type].count++;
    claimsByType[claim.insurance_type].amount += claim.amount_claimed;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gestion du Cycle de Revenus</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Pipeline d&apos;assurance, facturation et recouvrement — MAD
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => (window.location.href = "/admin/insurance-claims")}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Réclamation
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total réclamé"
          value={formatMAD(totalClaimed)}
          subtitle={`${claims.length} réclamations`}
          icon={FileText}
          color="text-blue-600"
          trend="neutral"
        />
        <KPICard
          title="Total encaissé"
          value={formatMAD(totalPaid)}
          subtitle={`Taux: ${collectionRate}%`}
          icon={DollarSign}
          color="text-green-600"
          trend={collectionRate >= 80 ? "up" : "down"}
        />
        <KPICard
          title="En attente"
          value={formatMAD(pendingClaims.reduce((s, c) => s + c.amount_claimed, 0))}
          subtitle={`${pendingClaims.length} réclamations`}
          icon={Clock}
          color="text-amber-600"
          trend="neutral"
        />
        <KPICard
          title="Factures impayées"
          value={formatMAD(outstandingAmount)}
          subtitle={`${overdueInvoices.length} en retard`}
          icon={AlertCircle}
          color={overdueInvoices.length > 0 ? "text-red-600" : "text-muted-foreground"}
          trend={overdueInvoices.length > 5 ? "down" : "neutral"}
        />
      </div>

      {/* Insurance breakdown */}
      {Object.keys(claimsByType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par Assurance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(claimsByType).map(([type, stats]) => (
                <div key={type} className="rounded-lg border p-3 space-y-1">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${INSURANCE_COLORS[type] ?? ""}`}
                  >
                    {type}
                  </span>
                  <p className="font-semibold text-sm">{formatMAD(stats.amount)}</p>
                  <p className="text-xs text-muted-foreground">{stats.count} réclamations</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collection rate visual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Taux de Recouvrement</span>
            <span
              className={`text-lg font-bold ${collectionRate >= 80 ? "text-green-600" : collectionRate >= 60 ? "text-amber-600" : "text-red-600"}`}
            >
              {collectionRate}%
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  collectionRate >= 80
                    ? "bg-green-500"
                    : collectionRate >= 60
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
                data-width={Math.round(collectionRate)}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Réclamé: {formatMAD(totalClaimed)}</span>
              <span>Approuvé: {formatMAD(totalApproved)}</span>
              <span>Encaissé: {formatMAD(totalPaid)}</span>
            </div>
          </div>

          {rejectedClaims.length > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">
                {rejectedClaims.length} réclamation(s) refusée(s) pour{" "}
                {formatMAD(rejectedClaims.reduce((s, c) => s + c.amount_claimed, 0))} — vérifiez les
                motifs de refus
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claims table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Réclamations d&apos;Assurance</CardTitle>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              {(["all", "draft", "submitted", "approved", "rejected", "paid"] as const).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      statusFilter === status
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {status === "all"
                      ? "Tous"
                      : (CLAIM_STATUS_CONFIG[status as InsuranceClaim["status"]]?.label ?? status)}
                  </button>
                ),
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredClaims.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Aucune réclamation trouvée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredClaims.slice(0, 15).map((claim) => {
                const config = CLAIM_STATUS_CONFIG[claim.status];
                const Icon = config.icon;
                return (
                  <button
                    type="button"
                    key={claim.id}
                    className="w-full text-left flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => (window.location.href = `/admin/insurance-claims/${claim.id}`)}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        claim.status === "paid"
                          ? "text-green-500"
                          : claim.status === "rejected"
                            ? "text-red-500"
                            : claim.status === "approved"
                              ? "text-amber-500"
                              : "text-muted-foreground"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium font-mono">{claim.claim_number}</p>
                        <span
                          className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${INSURANCE_COLORS[claim.insurance_type] ?? ""}`}
                        >
                          {claim.insurance_type}
                        </span>
                        <Badge variant={config.variant} className="text-[10px]">
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(claim.created_at).toLocaleDateString("fr-MA")}
                        {claim.notes && ` · ${claim.notes.slice(0, 40)}...`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm">{formatMAD(claim.amount_claimed)}</p>
                      {claim.amount_paid !== null && claim.amount_paid > 0 && (
                        <p className="text-xs text-green-600">
                          Payé: {formatMAD(claim.amount_paid)}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
              {filteredClaims.length > 15 && (
                <p className="text-center text-xs text-muted-foreground py-2">
                  +{filteredClaims.length - 15} réclamations supplémentaires
                  <a href="/admin/insurance-claims" className="text-primary ml-1 hover:underline">
                    Voir tout
                  </a>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
