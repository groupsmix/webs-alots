/* eslint-disable i18next/no-literal-string -- French UI strings */
"use client";

import { AlertTriangle, Archive, Clock, RefreshCw, Shield } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface RetentionSummary {
  [table: string]: {
    archived: number;
    pending_deletion: number;
    deleted: number;
  };
}

interface RetentionPolicy {
  table_name: string;
  retention_days: number;
  auto_archive: boolean;
  notify_before_days: number;
  updated_at: string;
}

interface ApproachingRecord {
  id: string;
  source_table: string;
  source_id: string;
  patient_id: string | null;
  retention_expires_at: string;
  created_at: string;
}

interface RetentionData {
  summary: RetentionSummary;
  policies: RetentionPolicy[];
  approachingExpiry: ApproachingRecord[];
  retentionPeriodYears: number;
  legalBasis: string;
}

const TABLE_LABELS: Record<string, string> = {
  appointments: "Rendez-vous",
  consultation_notes: "Notes de consultation",
  medical_records: "Dossiers médicaux",
  prescriptions: "Ordonnances",
  payments: "Paiements",
  invoices: "Factures",
};

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString("fr-FR", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function daysUntil(ts: string): number {
  return Math.ceil((new Date(ts).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function DataRetentionDashboard() {
  const [data, setData] = useState<RetentionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/data-retention");
      const json = await res.json();
      if (!json.ok) {
        setError("Erreur lors du chargement");
        return;
      }
      setData(json.data);
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Chargement...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const totalArchived = Object.values(data.summary).reduce((s, v) => s + v.archived, 0);
  const totalPendingDeletion = Object.values(data.summary).reduce(
    (s, v) => s + v.pending_deletion,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Legal notice */}
      <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-[var(--oltigo-green)] dark:text-[#2f8f63] mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-blue-900 dark:text-blue-300">
            {data.legalBasis} — Période de conservation : {data.retentionPeriodYears} ans
          </p>
          <p className="text-blue-700 dark:text-blue-400 mt-1">
            Les dossiers médicaux sont automatiquement archivés après la période légale de
            conservation. Les enregistrements approchant l&apos;expiration sont signalés pour
            révision.
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Archive className="h-4 w-4" />
            Enregistrements archivés
          </div>
          <p className="text-2xl font-bold mt-1">{totalArchived}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            En attente de suppression
          </div>
          <p className="text-2xl font-bold mt-1">{totalPendingDeletion}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Approchant l&apos;expiration
          </div>
          <p className="text-2xl font-bold mt-1">{data.approachingExpiry.length}</p>
        </div>
      </div>

      {/* Archive summary by table */}
      <div className="rounded-lg border">
        <div className="border-b bg-muted/50 px-4 py-3">
          <h2 className="text-sm font-semibold">Résumé par type de données</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium">Table</th>
                <th className="px-4 py-3 text-left font-medium">Archivés</th>
                <th className="px-4 py-3 text-left font-medium">En attente</th>
                <th className="px-4 py-3 text-left font-medium">Supprimés</th>
                <th className="px-4 py-3 text-left font-medium">Conservation</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(data.summary).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Aucun enregistrement archivé
                  </td>
                </tr>
              ) : (
                Object.entries(data.summary).map(([table, counts]) => {
                  const policy = data.policies.find((p) => p.table_name === table);
                  const retentionDays = policy?.retention_days ?? 1826;
                  return (
                    <tr key={table} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{TABLE_LABELS[table] ?? table}</td>
                      <td className="px-4 py-3">{counts.archived}</td>
                      <td className="px-4 py-3">
                        {counts.pending_deletion > 0 ? (
                          <Badge variant="warning">{counts.pending_deletion}</Badge>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{counts.deleted}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {Math.round(retentionDays / 365)} ans
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Records approaching expiry */}
      {data.approachingExpiry.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b bg-yellow-50 dark:bg-yellow-950/30 px-4 py-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--signal-amber)]" />
              Enregistrements approchant l&apos;expiration
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">ID source</th>
                  <th className="px-4 py-3 text-left font-medium">Date d&apos;archivage</th>
                  <th className="px-4 py-3 text-left font-medium">Expire dans</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.approachingExpiry.map((record) => {
                  const days = daysUntil(record.retention_expires_at);
                  return (
                    <tr key={record.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {TABLE_LABELS[record.source_table] ?? record.source_table}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {record.source_id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(record.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={days <= 30 ? "destructive" : "warning"}>
                          {days} jour{days !== 1 ? "s" : ""}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
