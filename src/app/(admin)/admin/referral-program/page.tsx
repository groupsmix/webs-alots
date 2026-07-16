"use client";

import {
  Gift,
  Copy,
  Check,
  Share2,
  Loader2,
  ExternalLink,
  Users,
  Award,
  Clock,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
}

interface ReferralData {
  code: string;
  codeId: string;
  discountPct: number;
  discountMonths: number;
  referralUrl: string;
  stats: {
    signups: number;
    firstPayments: number;
  };
  credits: ReferralCredit[];
}

const STATUS_LABELS: Record<ReferralCredit["status"], string> = {
  pending: "En attente",
  approved: "Approuvé",
  applied: "Appliqué",
  rejected: "Refusé",
};

const STATUS_VARIANTS: Record<
  ReferralCredit["status"],
  "default" | "secondary" | "destructive" | "warning"
> = {
  pending: "warning",
  approved: "default",
  applied: "secondary",
  rejected: "destructive",
};

const PAYOUT_LABELS: Record<string, string> = {
  account_credit: "Crédit compte",
  discount: "Remise",
  cash_transfer: "Virement",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReferralProgramPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/referral-program");
      const json = await res.json();
      if (json.ok) {
        setData(json.data as ReferralData);
      } else {
        setError((json.error as string) ?? "Erreur lors du chargement");
        logger.warn("Failed to load referral program data", {
          context: "referral-program-page",
          error: json.error,
        });
      }
    } catch (err) {
      setError("Erreur réseau");
      logger.warn("Network error loading referral data", {
        context: "referral-program-page",
        error: err,
      });
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

  const copyToClipboard = async (text: string, type: "code" | "url") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "code") {
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      } else {
        setUrlCopied(true);
        setTimeout(() => setUrlCopied(false), 2000);
      }
    } catch {
      logger.warn("Clipboard copy failed", { context: "referral-program-page" });
    }
  };

  const openWhatsApp = () => {
    if (!data) return;
    const message = encodeURIComponent(
      `Rejoignez Oltigo Health et bénéficiez de ${data.discountPct}% de réduction pendant ${data.discountMonths} mois ! Utilisez mon lien de parrainage : ${data.referralUrl}`,
    );
    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
  };

  const totalCreditsCentimes = (data?.credits ?? [])
    .filter((c) => c.status !== "rejected")
    .reduce((sum, c) => sum + c.amount_centimes, 0);

  const pendingCreditsCentimes = (data?.credits ?? [])
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + c.amount_centimes, 0);

  const formatMAD = (centimes: number) => `${(centimes / 100).toFixed(2)} MAD`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin me-2" />
        Chargement du programme de parrainage...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Breadcrumb
          items={[
            { label: "Admin", href: "/admin/dashboard" },
            { label: "Programme de parrainage" },
          ]}
        />
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-destructive font-medium">
            {error ?? "Impossible de charger les données"}
          </p>
          <Button variant="outline" className="mt-4" onClick={loadData}>
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Programme de parrainage" }]}
      />

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          Programme de parrainage
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Parrainez d&apos;autres cliniques et gagnez des crédits sur votre abonnement.
        </p>
      </div>

      {/* Referral Code Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Votre code de parrainage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Big code display */}
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-lg bg-muted px-5 py-4 text-center">
              <span className="text-3xl font-mono font-bold tracking-widest text-primary">
                {data.code}
              </span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(data.code, "code")}
              title="Copier le code"
            >
              {codeCopied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Les cliniques qui utilisent votre code bénéficient de{" "}
            <strong>{data.discountPct}% de réduction</strong> pendant{" "}
            <strong>{data.discountMonths} mois</strong>.
          </p>

          {/* Referral URL */}
          <div>
            <p className="text-sm font-medium mb-2">Lien de parrainage</p>
            <div className="flex items-center gap-2">
              <Input value={data.referralUrl} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(data.referralUrl, "url")}
                title="Copier le lien"
              >
                {urlCopied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(data.referralUrl, "_blank", "noopener,noreferrer")}
                title="Ouvrir le lien"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Share via WhatsApp */}
          <Button
            className="w-full sm:w-auto gap-2 bg-[#25D366] hover:bg-[#1ebe5b] text-white"
            onClick={openWhatsApp}
          >
            <Share2 className="h-4 w-4" />
            Partager via WhatsApp
          </Button>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cliniques parrainées
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.signups}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.stats.firstPayments} ont effectué un premier paiement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Crédits totaux
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMAD(totalCreditsCentimes)}</div>
            <p className="text-xs text-muted-foreground mt-1">Crédits gagnés</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Crédits en attente
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMAD(pendingCreditsCentimes)}</div>
            <p className="text-xs text-muted-foreground mt-1">En attente d&apos;approbation</p>
          </CardContent>
        </Card>
      </div>

      {/* Credits Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des crédits</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-start p-3 font-medium">Montant</th>
                <th className="text-start p-3 font-medium">Type</th>
                <th className="text-start p-3 font-medium">Statut</th>
                <th className="text-start p-3 font-medium">Date</th>
                <th className="text-start p-3 font-medium">Appliqué le</th>
              </tr>
            </thead>
            <tbody>
              {data.credits.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    Aucun crédit pour le moment. Commencez à parrainer des cliniques !
                  </td>
                </tr>
              )}
              {data.credits.map((credit) => (
                <tr key={credit.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">{formatMAD(credit.amount_centimes)}</td>
                  <td className="p-3 text-muted-foreground">
                    {PAYOUT_LABELS[credit.payout_type] ?? credit.payout_type}
                  </td>
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
    </div>
  );
}
