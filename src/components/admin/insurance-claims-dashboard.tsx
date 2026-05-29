/* eslint-disable i18next/no-literal-string -- French UI strings */
"use client";

import { ChevronLeft, ChevronRight, RefreshCw, Eye, Shield } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface InsuranceClaim {
  id: string;
  patient_id: string;
  claim_number: string;
  insurance_type: string;
  status: string;
  claimed_amount_centimes: number;
  approved_amount_centimes: number | null;
  patient_share_centimes: number | null;
  rejection_reason: string | null;
  reviewer_notes: string | null;
  line_items: ClaimLineItem[];
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface ClaimLineItem {
  description: string;
  quantity: number;
  unit_price_centimes: number;
  category?: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Soumise",
  under_review: "En révision",
  approved: "Approuvée",
  partially_approved: "Partiellement approuvée",
  rejected: "Rejetée",
  appealed: "En appel",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  submitted: "default",
  under_review: "default",
  approved: "secondary",
  partially_approved: "secondary",
  rejected: "destructive",
  appealed: "outline",
};

const INSURANCE_LABELS: Record<string, string> = {
  CNSS: "CNSS",
  CNOPS: "CNOPS",
  AMO: "AMO",
  RAMED: "RAMED",
};

function formatCentimes(centimes: number): string {
  return `${(centimes / 100).toFixed(2)} MAD`;
}

export function InsuranceClaimsDashboard() {
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedClaim, setSelectedClaim] = useState<InsuranceClaim | null>(null);
  const limit = 20;

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("insurance_type", typeFilter);
      const res = await fetch(`/api/insurance-claims?${params}`);
      const json = await res.json();
      if (json.ok) {
        setClaims(json.data.claims);
        setTotal(json.data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleReview = async (
    id: string,
    status: string,
    approvedAmount?: number,
    rejectionReason?: string,
  ) => {
    const body: Record<string, unknown> = { status };
    if (approvedAmount !== undefined) body.approved_amount_centimes = approvedAmount;
    if (rejectionReason) body.rejection_reason = rejectionReason;

    const res = await fetch(`/api/insurance-claims/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setSelectedClaim(null);
      fetchClaims();
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Réclamations d&apos;assurance</h2>
          <p className="text-muted-foreground">
            Révision des réclamations CNSS, CNOPS, AMO et RAMED
          </p>
        </div>
        <button
          onClick={fetchClaims}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="draft">Brouillon</option>
          <option value="submitted">Soumise</option>
          <option value="under_review">En révision</option>
          <option value="approved">Approuvée</option>
          <option value="rejected">Rejetée</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Tous les types</option>
          <option value="CNSS">CNSS</option>
          <option value="CNOPS">CNOPS</option>
          <option value="AMO">AMO</option>
          <option value="RAMED">RAMED</option>
        </select>
      </div>

      {selectedClaim && (
        <div className="rounded-lg border p-6 space-y-4 bg-muted/20">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Détail — {selectedClaim.claim_number}</h3>
            <button
              onClick={() => setSelectedClaim(null)}
              className="rounded-md border px-3 py-1 text-sm hover:bg-accent"
            >
              Fermer
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Type d&apos;assurance</p>
              <p className="font-medium">{INSURANCE_LABELS[selectedClaim.insurance_type]}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Montant réclamé</p>
              <p className="font-medium">{formatCentimes(selectedClaim.claimed_amount_centimes)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Montant approuvé</p>
              <p className="font-medium">
                {selectedClaim.approved_amount_centimes !== null
                  ? formatCentimes(selectedClaim.approved_amount_centimes)
                  : "—"}
              </p>
            </div>
          </div>

          {Array.isArray(selectedClaim.line_items) && selectedClaim.line_items.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium">Prestations détaillées</h4>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">Qté</th>
                      <th className="px-3 py-2 text-right">Prix unitaire</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedClaim.line_items.map((item, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="px-3 py-2">{item.description}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">
                          {formatCentimes(item.unit_price_centimes)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatCentimes(item.quantity * item.unit_price_centimes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedClaim.status === "under_review" && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={() =>
                  handleReview(selectedClaim.id, "approved", selectedClaim.claimed_amount_centimes)
                }
                className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
              >
                Approuver
              </button>
              <button
                onClick={() =>
                  handleReview(selectedClaim.id, "rejected", undefined, "Non conforme")
                }
                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                Rejeter
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : claims.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Shield className="h-12 w-12" />
          <p>Aucune réclamation trouvée</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">N° Réclamation</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Montant réclamé</th>
                <th className="px-4 py-3 text-right font-medium">Montant approuvé</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{claim.claim_number}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{INSURANCE_LABELS[claim.insurance_type]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[claim.status] ?? "default"}>
                      {STATUS_LABELS[claim.status] ?? claim.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCentimes(claim.claimed_amount_centimes)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {claim.approved_amount_centimes !== null
                      ? formatCentimes(claim.approved_amount_centimes)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(claim.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedClaim(claim)}
                      className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent"
                    >
                      <Eye className="h-3 w-3" />
                      Détail
                    </button>
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
            {total} réclamation{total !== 1 ? "s" : ""} au total
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
