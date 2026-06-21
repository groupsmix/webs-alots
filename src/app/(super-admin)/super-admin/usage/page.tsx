/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import {
  CalendarCheck,
  Users,
  Building2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Loader2,
  ExternalLink,
  AlertTriangle,
  MapPin,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/logger";

// ── Types ──

interface ClinicUsage {
  id: string;
  name: string;
  type: string;
  status: string;
  appointments: number;
  users: number;
  created_at: string;
}

type SortKey = "appointments" | "users" | "name";
type SortDir = "asc" | "desc";

// ── SortIcon (top-level so React Compiler does not flag it as created during render) ──

function SortIcon({
  columnKey,
  sortKey,
  sortDir,
}: {
  columnKey: SortKey;
  sortKey: SortKey | null;
  sortDir: "asc" | "desc";
}) {
  if (sortKey !== columnKey) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return sortDir === "asc" ? (
    <ChevronUp className="h-3 w-3 ml-1" />
  ) : (
    <ChevronDown className="h-3 w-3 ml-1" />
  );
}

// ── Component ──

export default function UsagePage() {
  const [clinics, setClinics] = useState<ClinicUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("appointments");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  // I2: surface a failed/blocked fetch instead of a misleading "no data" state.
  const [fetchError, setFetchError] = useState(false);
  const [geoBlocked, setGeoBlocked] = useState(false);

  const loadUsage = useCallback(async () => {
    setFetchError(false);
    setGeoBlocked(false);
    try {
      const res = await fetch("/api/admin/usage");
      let isGeo = false;
      try {
        const json = await res.json();
        if (res.ok && json.ok) {
          setClinics(json.data.clinics);
          return;
        }
        isGeo = json?.code === "GEO_RESTRICTED";
        logger.warn("Failed to load usage data", { context: "usage-page", error: json?.error });
      } catch {
        /* non-JSON error body */
      }
      if (isGeo) setGeoBlocked(true);
      else setFetchError(true);
    } catch (err) {
      logger.warn("Failed to load usage data", { context: "usage-page", error: err });
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const totals = useMemo(() => {
    return clinics.reduce(
      (acc, c) => ({
        appointments: acc.appointments + c.appointments,
        users: acc.users + c.users,
        clinics: acc.clinics + 1,
        active: acc.active + (c.status === "active" ? 1 : 0),
      }),
      { appointments: 0, users: 0, clinics: 0, active: 0 },
    );
  }, [clinics]);

  const sortedClinics = useMemo(() => {
    return [...clinics].sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      if (sortKey === "name") {
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
        return sortDir === "asc"
          ? (va as string).localeCompare(vb as string)
          : (vb as string).localeCompare(va as string);
      }
      va = a[sortKey];
      vb = b[sortKey];
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [clinics, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Métriques usage" },
        ]}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Métriques d&apos;utilisation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suivi de l&apos;utilisation par clinique : rendez-vous, utilisateurs et activité
        </p>
      </div>

      {/* I2: geo-block / failure banners */}
      {geoBlocked && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-900/20 dark:border-amber-700">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Accès restreint depuis votre localisation
            </p>
            <p className="text-amber-700 dark:text-amber-300 mt-0.5">
              L&apos;API d&apos;utilisation est limitée aux accès depuis le Maroc. Les chiffres
              affichés (zéro) ne reflètent pas l&apos;activité réelle.
            </p>
          </div>
        </div>
      )}
      {fetchError && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="flex-1 text-destructive">
            Impossible de charger les données d&apos;utilisation (erreur réseau ou API
            indisponible). Les chiffres affichés peuvent être incomplets.
          </span>
          <Button variant="outline" size="sm" onClick={() => loadUsage()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Réessayer
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total des cliniques
            </CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : totals.clinics}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? "" : `${totals.active} actives`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total des rendez-vous
            </CardTitle>
            <CalendarCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : totals.appointments}</div>
            <p className="text-xs text-muted-foreground">depuis le début</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total des utilisateurs
            </CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : totals.users}</div>
            <p className="text-xs text-muted-foreground">toutes cliniques confondues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Moy. par clinique
            </CardTitle>
            <CalendarCheck className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading || totals.clinics === 0
                ? "—"
                : Math.round(totals.appointments / totals.clinics)}
            </div>
            <p className="text-xs text-muted-foreground">rendez-vous</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Clinic Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Utilisation par clinique</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">
                  <button
                    type="button"
                    className="inline-flex items-center hover:text-foreground"
                    onClick={() => handleSort("name")}
                  >
                    Clinique
                    <SortIcon columnKey="name" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Statut</th>
                <th className="text-right p-3 font-medium">
                  <button
                    type="button"
                    className="inline-flex items-center hover:text-foreground"
                    onClick={() => handleSort("appointments")}
                  >
                    Rendez-vous
                    <SortIcon columnKey="appointments" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-right p-3 font-medium">
                  <button
                    type="button"
                    className="inline-flex items-center hover:text-foreground"
                    onClick={() => handleSort("users")}
                  >
                    Utilisateurs
                    <SortIcon columnKey="users" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </th>
                <th className="p-3 font-medium">Détail</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Chargement des données d&apos;utilisation…
                  </td>
                </tr>
              )}
              {!loading && sortedClinics.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    {geoBlocked || fetchError
                      ? "Données indisponibles — voir le message ci-dessus."
                      : "Aucune donnée de clinique trouvée."}
                  </td>
                </tr>
              )}
              {sortedClinics.map((clinic) => (
                <tr key={clinic.id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">{clinic.name}</td>
                  <td className="p-3 text-muted-foreground capitalize">{clinic.type}</td>
                  <td className="p-3">
                    <Badge
                      variant={clinic.status === "active" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {clinic.status === "active" ? "Actif" : clinic.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">{clinic.appointments}</td>
                  <td className="p-3 text-right">{clinic.users}</td>
                  <td className="p-3">
                    <Link
                      href={`/super-admin/usage/clinic?id=${clinic.id}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Voir
                    </Link>
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
