/* eslint-disable i18next/no-literal-string */
"use client";

import { Gift, Users, CreditCard, TrendingUp, Award, Loader2, Check, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReferralCredit {
  id: string;
  amount_centimes: number;
  currency: string;
  payout_type: string;
  status: "pending" | "approved" | "applied" | "rejected";
  created_at: string;
  applied_at: string | null;
  beneficiary_clinic_id: string;
  clinics: { name: string } | null;
}

interface LeaderboardRow {
  clinicId: string;
  clinicName: string;
  signups: number;
  code: string | null;
  totalCreditsCentimes: number;
}

interface FunnelStats {
  totalCodesIssued: number;
  totalSignups: number;
  totalFirstPayments: number;
  totalRewardsTriggered: number;
}

interface ReferralCreditsData {
  credits: ReferralCredit[];
  leaderboard: LeaderboardRow[];
  funnel: FunnelStats;
}

type CreditStatus = ReferralCredit["status"];

const STATUS_LABELS: Record<CreditStatus, string> = {
  pending: "En attente",
  approved: "Approuve",
  applied: "Applique",
  rejected: "Refuse",
};

const STATUS_VARIANTS: Record<CreditStatus, "default" | "secondary" | "destructive" | "warning"> = {
  pending: "warning",
  approved: "default",
  applied: "secondary",
  rejected: "destructive",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuperAdminReferralProgramPage() {
  const [data, setData] = useState<ReferralCreditsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/referral-credits");
      const json = await res.json();
      if (json.ok) {
        setData(json.data as ReferralCreditsData);
      } else {
        setError((json.error as string) ?? "Erreur lors du chargement");
        logger.warn("Failed to load referral credits", {
          context: "super-admin-referral-program",
          error: json.error,
        });
      }
    } catch (err) {
      setError("Erreur reseau");
      logger.warn("Network error loading referral credits", {
        context: "super-admin-referral-program",
        error: err,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreditAction = async (creditId: string, action: "approve" | "reject") => {
    setProcessingId(creditId);
    try {
      const res = await fetch("/api/super-admin/referral-credits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditId, action }),
      });
      const json = await res.json();
      if (json.ok) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            credits: prev.credits.map((c) =>
              c.id === creditId
                ? {
                    ...c,
                    status: action === "approve" ? ("approved" as const) : ("rejected" as const),
                  }
                : c,
            ),
          };
        });
      } else {
        logger.warn("Failed to process credit action", {
          context: "super-admin-referral-program",
          creditId,
          action,
          error: json.error,
        });
      }
    } catch (err) {
      logger.warn("Network error processing credit action", {
        context: "super-admin-referral-program",
        creditId,
        error: err,
      });
    } finally {
      setProcessingId(null);
    }
  };

  const formatMAD = (centimes: number) => `${(centimes / 100).toFixed(2)} MAD`;

  const pendingCredits = (data?.credits ?? []).filter((c) => c.status === "pending");
  const resolvedCredits = (data?.credits ?? []).filter((c) => c.status !== "pending");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Chargement du programme de parrainage...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Breadcrumb
          items={[
            { label: "Super Admin", href: "/super-admin/dashboard" },
            { label: "Programme de parrainage" },
          ]}
        />
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-destructive font-medium">
            {error ?? "Impossible de charger les donnees"}
          </p>
          <Button variant="outline" className="mt-4" onClick={loadData}>
            Reessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Programme de parrainage" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          Programme de parrainage — cliniques
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acquisition de nouvelles cliniques via parrainage. Distinct des referencements
          medecin-a-patient.
        </p>
      </div>

      {/* Funnel KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Codes emis</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.funnel.totalCodesIssued}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inscriptions attribuees
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.funnel.totalSignups}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Premiers paiements
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.funnel.totalFirstPayments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recompenses declenchees
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.funnel.totalRewardsTriggered}</div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4" />
            Top referants (par inscriptions)
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">#</th>
                <th className="text-left p-3 font-medium">Clinique</th>
                <th className="text-left p-3 font-medium">Code</th>
                <th className="text-right p-3 font-medium">Inscriptions</th>
                <th className="text-right p-3 font-medium">Credits gagnes</th>
              </tr>
            </thead>
            <tbody>
              {data.leaderboard.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    Aucune donnee de parrainage disponible.
                  </td>
                </tr>
              )}
              {data.leaderboard.map((row, idx) => (
                <tr key={row.clinicId} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 text-muted-foreground font-medium">{idx + 1}</td>
                  <td className="p-3 font-medium">{row.clinicName}</td>
                  <td className="p-3">
                    {row.code ? (
                      <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                        {row.code}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-bold">{row.signups}</td>
                  <td className="p-3 text-right text-muted-foreground">
                    {formatMAD(row.totalCreditsCentimes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pending Payouts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Versements en attente ({pendingCredits.length})
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Clinique</th>
                <th className="text-right p-3 font-medium">Montant</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingCredits.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    Aucun versement en attente.
                  </td>
                </tr>
              )}
              {pendingCredits.map((credit) => (
                <tr key={credit.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">
                    {credit.clinics?.name ?? credit.beneficiary_clinic_id.slice(0, 8) + "..."}
                  </td>
                  <td className="p-3 text-right font-bold">{formatMAD(credit.amount_centimes)}</td>
                  <td className="p-3 text-muted-foreground capitalize">
                    {credit.payout_type.replace(/_/g, " ")}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(credit.created_at).toLocaleDateString("fr-MA")}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                        disabled={processingId === credit.id}
                        onClick={() => handleCreditAction(credit.id, "approve")}
                      >
                        {processingId === credit.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Approuver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={processingId === credit.id}
                        onClick={() => handleCreditAction(credit.id, "reject")}
                      >
                        <X className="h-3 w-3" />
                        Refuser
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Resolved Credits */}
      {resolvedCredits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique des versements</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Clinique</th>
                  <th className="text-right p-3 font-medium">Montant</th>
                  <th className="text-left p-3 font-medium">Statut</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Applique le</th>
                </tr>
              </thead>
              <tbody>
                {resolvedCredits.map((credit) => (
                  <tr key={credit.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">
                      {credit.clinics?.name ?? credit.beneficiary_clinic_id.slice(0, 8) + "..."}
                    </td>
                    <td className="p-3 text-right">{formatMAD(credit.amount_centimes)}</td>
                    <td className="p-3">
                      <Badge variant={STATUS_VARIANTS[credit.status]} className="text-xs">
                        {STATUS_LABELS[credit.status]}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(credit.created_at).toLocaleDateString("fr-MA")}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {credit.applied_at
                        ? new Date(credit.applied_at).toLocaleDateString("fr-MA")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
