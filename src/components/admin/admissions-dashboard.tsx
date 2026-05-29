/* eslint-disable i18next/no-literal-string -- French UI strings */
"use client";

import {
  BedDouble,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ArrowRightLeft,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface Admission {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  admission_date: string;
  discharge_date: string | null;
  transfer_date: string | null;
  bed_number: string | null;
  ward: string | null;
  status: string;
  diagnosis: string | null;
  notes: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  admitted: "Admis",
  discharged: "Sorti",
  transferred: "Transféré",
  deceased: "Décédé",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  admitted: "default",
  discharged: "secondary",
  transferred: "outline",
  deceased: "destructive",
};

export function AdmissionsDashboard() {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const limit = 20;

  const fetchAdmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admissions?${params}`);
      const json = await res.json();
      if (json.ok) {
        setAdmissions(json.data.admissions);
        setTotal(json.data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchAdmissions();
  }, [fetchAdmissions]);

  const handleAction = async (id: string, action: "discharge" | "transfer") => {
    const res = await fetch(`/api/admissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) fetchAdmissions();
  };

  const filtered = admissions.filter(
    (a) =>
      !search ||
      a.diagnosis?.toLowerCase().includes(search.toLowerCase()) ||
      a.ward?.toLowerCase().includes(search.toLowerCase()) ||
      a.bed_number?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Admissions</h2>
          <p className="text-muted-foreground">Gestion des admissions, sorties et transferts</p>
        </div>
        <button
          onClick={fetchAdmissions}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par diagnostic, salle, lit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="admitted">Admis</option>
          <option value="discharged">Sorti</option>
          <option value="transferred">Transféré</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <BedDouble className="h-12 w-12" />
          <p>Aucune admission trouvée</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Patient</th>
                <th className="px-4 py-3 text-left font-medium">Salle</th>
                <th className="px-4 py-3 text-left font-medium">Lit</th>
                <th className="px-4 py-3 text-left font-medium">Diagnostic</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-left font-medium">Date d&apos;admission</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((admission) => (
                <tr key={admission.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    {admission.patient_id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">{admission.ward ?? "—"}</td>
                  <td className="px-4 py-3">{admission.bed_number ?? "—"}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{admission.diagnosis ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[admission.status] ?? "default"}>
                      {STATUS_LABELS[admission.status] ?? admission.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(admission.admission_date).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    {admission.status === "admitted" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(admission.id, "discharge")}
                          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent"
                          title="Sortie du patient"
                        >
                          <LogOut className="h-3 w-3" />
                          Sortie
                        </button>
                        <button
                          onClick={() => handleAction(admission.id, "transfer")}
                          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent"
                          title="Transférer le patient"
                        >
                          <ArrowRightLeft className="h-3 w-3" />
                          Transfert
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} admission{total !== 1 ? "s" : ""} au total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border p-2 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border p-2 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
