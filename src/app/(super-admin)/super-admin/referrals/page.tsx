/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import {
  CheckCheck,
  Check,
  Clock,
  Users,
  Loader2,
  AlertTriangle,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logger } from "@/lib/logger";
import { formatDisplayDate } from "@/lib/utils";

// ── Types ──

type ReferralStatus = "pending" | "accepted" | "declined" | "completed";

interface Referral {
  id: string;
  clinic_id: string;
  referring_doctor_id: string;
  referred_to_doctor_id: string;
  patient_id: string;
  reason: string | null;
  status: ReferralStatus;
  created_at: string;
  clinics: { name: string } | null;
}

const STATUS_LABELS: Record<ReferralStatus, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  declined: "Refusée",
  completed: "Terminée",
};

const STATUS_VARIANTS: Record<ReferralStatus, "default" | "secondary" | "destructive" | "warning"> =
  {
    pending: "warning",
    accepted: "default",
    declined: "destructive",
    completed: "secondary",
  };

type StatusFilter = "all" | ReferralStatus;

// ── Component ──

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // I2: distinguish a genuine empty result from a failed/blocked fetch so the
  // table never shows "Aucune référence" when the API actually errored.
  const [fetchError, setFetchError] = useState(false);
  const [geoBlocked, setGeoBlocked] = useState(false);

  const loadReferrals = useCallback(async () => {
    setFetchError(false);
    setGeoBlocked(false);
    try {
      const res = await fetch("/api/admin/referrals");
      let isGeo = false;
      try {
        const json = await res.json();
        if (res.ok && json.ok) {
          setReferrals(json.data.referrals);
          return;
        }
        isGeo = json?.code === "GEO_RESTRICTED";
        logger.warn("Failed to load referrals", { context: "referrals-page", error: json?.error });
      } catch {
        /* non-JSON error body */
      }
      if (isGeo) setGeoBlocked(true);
      else setFetchError(true);
    } catch (err) {
      logger.warn("Failed to load referrals", { context: "referrals-page", error: err });
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  const filtered =
    statusFilter === "all" ? referrals : referrals.filter((r) => r.status === statusFilter);

  const totalReferrals = referrals.length;
  const completed = referrals.filter((r) => r.status === "completed").length;
  const pending = referrals.filter((r) => r.status === "pending").length;
  const accepted = referrals.filter((r) => r.status === "accepted").length;

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Références" }]}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Références patients</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suivez les références de patients entre médecins, toutes cliniques confondues
        </p>
      </div>

      {/* I2: geo-block / failure banners — shown instead of a misleading empty table. */}
      {geoBlocked && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-900/20 dark:border-amber-700">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Accès restreint depuis votre localisation
            </p>
            <p className="text-amber-700 dark:text-amber-300 mt-0.5">
              L&apos;API des références est limitée aux accès depuis le Maroc. Les données ne
              peuvent pas être chargées depuis votre emplacement actuel.
            </p>
          </div>
        </div>
      )}
      {fetchError && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="flex-1 text-destructive">
            Impossible de charger les références (erreur réseau ou API indisponible).
          </span>
          <Button variant="outline" size="sm" onClick={() => loadReferrals()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Réessayer
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total des références
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : totalReferrals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Terminées</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En attente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Acceptées</CardTitle>
            <CheckCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : accepted}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="mb-4 max-w-xs">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="accepted">Acceptée</SelectItem>
            <SelectItem value="completed">Terminée</SelectItem>
            <SelectItem value="declined">Refusée</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liste des références</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Clinique</th>
                <th className="text-left p-3 font-medium">Motif</th>
                <th className="text-left p-3 font-medium">Statut</th>
                <th className="text-left p-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Chargement des références…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    {geoBlocked || fetchError
                      ? "Données indisponibles — voir le message ci-dessus."
                      : "Aucune référence trouvée."}
                  </td>
                </tr>
              )}
              {filtered.map((referral) => (
                <tr key={referral.id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">
                    {referral.clinics?.name ?? "Clinique inconnue"}
                  </td>
                  <td className="p-3 text-muted-foreground">{referral.reason ?? "—"}</td>
                  <td className="p-3">
                    <Badge variant={STATUS_VARIANTS[referral.status]} className="text-xs">
                      {STATUS_LABELS[referral.status]}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {formatDisplayDate(referral.created_at, "fr", "short")}
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
