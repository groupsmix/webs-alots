"use client";

import {
  FileText,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/locale-switcher";
import { useTenant } from "@/components/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils";

interface InsuranceClaim {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  insurance_type: string;
  policy_number: string | null;
  claim_number: string | null;
  amount_claimed: number;
  amount_approved: number | null;
  status: string;
  submitted_at: string | null;
  resolved_at: string | null;
  rejection_reason: string | null;
  diagnosis_code: string | null;
  treatment_description: string | null;
  notes: string | null;
  created_at: string;
}

interface ClaimSummary {
  total: number;
  draft: number;
  submitted: number;
  pending: number;
  approved: number;
  partiallyApproved: number;
  rejected: number;
  totalClaimed: number;
  totalApproved: number;
}

const INSURANCE_TYPES = ["CNSS", "CNOPS", "AMO", "RAMED", "private"] as const;

const INSURANCE_LABELS: Record<string, string> = {
  CNSS: "CNSS",
  CNOPS: "CNOPS",
  AMO: "AMO",
  RAMED: "RAMED",
  private: "Privée",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Soumise",
  pending: "En attente",
  approved: "Approuvée",
  partially_approved: "Partiellement approuvée",
  rejected: "Rejetée",
  appealed: "En appel",
};

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "approved"
      ? "success"
      : status === "rejected"
        ? "destructive"
        : status === "pending" || status === "submitted"
          ? "warning"
          : "secondary";

  return <Badge variant={variant}>{STATUS_LABELS[status] ?? status}</Badge>;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "rejected":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "pending":
    case "submitted":
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case "partially_approved":
      return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    default:
      return <FileText className="h-4 w-4 text-gray-400" />;
  }
}

export default function InsuranceClaimsPage() {
  const [locale] = useLocale();
  const tenant = useTenant();
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [summary, setSummary] = useState<ClaimSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<InsuranceClaim | null>(null);

  // Create form
  const [formPatientId, setFormPatientId] = useState("");
  const [formInsType, setFormInsType] = useState<string>("CNSS");
  const [formPolicyNumber, setFormPolicyNumber] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDiagnosis, setFormDiagnosis] = useState("");
  const [formTreatment, setFormTreatment] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Update form
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateAmountApproved, setUpdateAmountApproved] = useState("");
  const [updateClaimNumber, setUpdateClaimNumber] = useState("");
  const [updateRejectionReason, setUpdateRejectionReason] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterType !== "all") params.set("insurance_type", filterType);

      const res = await fetch(`/api/clinic-owner/insurance-claims?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setClaims(json.data.claims);
        setSummary(json.data.summary);
      }
    } catch (err) {
      logger.warn("Failed to load insurance claims", { context: "page", error: err });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType]);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    if (tenant?.clinicId)
      timeouts.push(
        setTimeout(() => {
          loadData();
        }, 0),
      );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [tenant?.clinicId, loadData]);

  const handleCreate = async () => {
    const amountCentimes = Math.round(parseFloat(formAmount) * 100);
    if (isNaN(amountCentimes) || amountCentimes < 0) return;

    const res = await fetch("/api/clinic-owner/insurance-claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: formPatientId,
        insurance_type: formInsType,
        policy_number: formPolicyNumber || undefined,
        amount_claimed: amountCentimes,
        diagnosis_code: formDiagnosis || undefined,
        treatment_description: formTreatment || undefined,
        notes: formNotes || undefined,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowAdd(false);
      setFormPatientId("");
      setFormInsType("CNSS");
      setFormPolicyNumber("");
      setFormAmount("");
      setFormDiagnosis("");
      setFormTreatment("");
      setFormNotes("");
      loadData();
    }
  };

  const openUpdate = (claim: InsuranceClaim) => {
    setSelectedClaim(claim);
    setUpdateStatus(claim.status);
    setUpdateAmountApproved(
      claim.amount_approved != null ? String(claim.amount_approved / 100) : "",
    );
    setUpdateClaimNumber(claim.claim_number ?? "");
    setUpdateRejectionReason(claim.rejection_reason ?? "");
    setShowUpdate(true);
  };

  const handleUpdate = async () => {
    if (!selectedClaim) return;

    const payload: Record<string, unknown> = { id: selectedClaim.id };
    if (updateStatus && updateStatus !== selectedClaim.status) payload.status = updateStatus;
    if (updateAmountApproved) {
      payload.amount_approved = Math.round(parseFloat(updateAmountApproved) * 100);
    }
    if (updateClaimNumber) payload.claim_number = updateClaimNumber;
    if (updateRejectionReason) payload.rejection_reason = updateRejectionReason;

    const res = await fetch(`/api/clinic-owner/insurance-claims/${selectedClaim.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.ok) {
      setShowUpdate(false);
      setSelectedClaim(null);
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Réclamations assurance" }]}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {}
        <h1 className="text-2xl font-bold">Gestion des réclamations d&apos;assurance</h1>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          {}
          <Plus className="h-4 w-4 me-1" /> Nouvelle réclamation
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Chargement...
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                {}
                <CardTitle className="text-sm font-medium">Total réclamations</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.total ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                {}
                <CardTitle className="text-sm font-medium">En attente</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(summary?.submitted ?? 0) + (summary?.pending ?? 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                {}
                <CardTitle className="text-sm font-medium">Montant réclamé</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((summary?.totalClaimed ?? 0) / 100, locale ?? "fr")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                {}
                <CardTitle className="text-sm font-medium">Montant approuvé</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((summary?.totalApproved ?? 0) / 100, locale ?? "fr")}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                {}
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type assurance" />
              </SelectTrigger>
              <SelectContent>
                {}
                <SelectItem value="all">Tous les types</SelectItem>
                {INSURANCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {INSURANCE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Claims Table */}
          <Card>
            <CardHeader>
              {}
              <CardTitle>Réclamations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-start">
                      {}
                      <th className="py-3 pe-4 font-medium">Statut</th>
                      {}
                      <th className="py-3 pe-4 font-medium">Type</th>
                      {}
                      <th className="py-3 pe-4 font-medium">N° Police</th>
                      {}
                      <th className="py-3 pe-4 font-medium text-end">Réclamé</th>
                      {}
                      <th className="py-3 pe-4 font-medium text-end">Approuvé</th>
                      {}
                      <th className="py-3 pe-4 font-medium">Date</th>
                      {}
                      <th className="py-3 font-medium text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((claim) => (
                      <tr key={claim.id} className="border-b last:border-0">
                        <td className="py-3 pe-4">
                          <div className="flex items-center gap-2">
                            <StatusIcon status={claim.status} />
                            <StatusBadge status={claim.status} />
                          </div>
                        </td>
                        <td className="py-3 pe-4">
                          {INSURANCE_LABELS[claim.insurance_type] ?? claim.insurance_type}
                        </td>
                        <td className="py-3 pe-4">{claim.policy_number ?? "—"}</td>
                        <td className="py-3 pe-4 text-end">
                          {formatCurrency(claim.amount_claimed / 100, locale ?? "fr")}
                        </td>
                        <td className="py-3 pe-4 text-end">
                          {claim.amount_approved != null
                            ? formatCurrency(claim.amount_approved / 100, locale ?? "fr")
                            : "—"}
                        </td>
                        <td className="py-3 pe-4">
                          {claim.created_at
                            ? new Date(claim.created_at).toLocaleDateString("fr-FR")
                            : "—"}
                        </td>
                        <td className="py-3 text-end">
                          {}
                          <Button variant="ghost" size="sm" onClick={() => openUpdate(claim)}>
                            Modifier
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {claims.length === 0 && (
                      <tr>
                        {}
                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                          Aucune réclamation trouvée
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Insurance Form Generation (Moroccan standards) */}
          <Card>
            <CardHeader>
              {}
              <CardTitle>Formulaires d&apos;assurance marocains</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="cnss">
                <TabsList>
                  <TabsTrigger value="cnss">CNSS</TabsTrigger>
                  <TabsTrigger value="cnops">CNOPS</TabsTrigger>
                  <TabsTrigger value="amo">AMO</TabsTrigger>
                  <TabsTrigger value="ramed">RAMED</TabsTrigger>
                </TabsList>
                <TabsContent value="cnss" className="mt-4">
                  <div className="p-4 border rounded-lg space-y-2">
                    {}
                    <h3 className="font-semibold">Formulaire de remboursement CNSS</h3>
                    {}
                    <p className="text-sm text-muted-foreground">
                      Feuille de soins pour remboursement auprès de la CNSS. Sélectionnez une
                      réclamation approuvée pour générer le formulaire.
                    </p>
                    <div className="text-sm">
                      {}
                      <p>
                        • Réclamations CNSS approuvées :{" "}
                        {
                          claims.filter(
                            (c) => c.insurance_type === "CNSS" && c.status === "approved",
                          ).length
                        }
                      </p>
                      {}
                      <p>
                        • Réclamations CNSS en attente :{" "}
                        {
                          claims.filter(
                            (c) =>
                              c.insurance_type === "CNSS" &&
                              (c.status === "pending" || c.status === "submitted"),
                          ).length
                        }
                      </p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="cnops" className="mt-4">
                  <div className="p-4 border rounded-lg space-y-2">
                    {}
                    <h3 className="font-semibold">Formulaire de remboursement CNOPS</h3>
                    {}
                    <p className="text-sm text-muted-foreground">
                      Bordereau de soins pour la Caisse Nationale des Organismes de Prévoyance
                      Sociale.
                    </p>
                    <div className="text-sm">
                      {}
                      <p>
                        • Réclamations CNOPS approuvées :{" "}
                        {
                          claims.filter(
                            (c) => c.insurance_type === "CNOPS" && c.status === "approved",
                          ).length
                        }
                      </p>
                      {}
                      <p>
                        • Réclamations CNOPS en attente :{" "}
                        {
                          claims.filter(
                            (c) =>
                              c.insurance_type === "CNOPS" &&
                              (c.status === "pending" || c.status === "submitted"),
                          ).length
                        }
                      </p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="amo" className="mt-4">
                  <div className="p-4 border rounded-lg space-y-2">
                    {}
                    <h3 className="font-semibold">Formulaire AMO</h3>
                    {}
                    <p className="text-sm text-muted-foreground">
                      Formulaire d&apos;Assurance Maladie Obligatoire pour les soins ambulatoires.
                    </p>
                    <div className="text-sm">
                      {}
                      <p>
                        • Réclamations AMO approuvées :{" "}
                        {
                          claims.filter(
                            (c) => c.insurance_type === "AMO" && c.status === "approved",
                          ).length
                        }
                      </p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="ramed" className="mt-4">
                  <div className="p-4 border rounded-lg space-y-2">
                    {}
                    <h3 className="font-semibold">Formulaire RAMED</h3>
                    {}
                    <p className="text-sm text-muted-foreground">
                      Régime d&apos;Assistance Médicale pour les personnes économiquement démunies.
                    </p>
                    <div className="text-sm">
                      {}
                      <p>
                        • Réclamations RAMED :{" "}
                        {claims.filter((c) => c.insurance_type === "RAMED").length}
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      {/* Create Claim Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            {}
            <DialogTitle>Nouvelle réclamation d&apos;assurance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              {}
              <span className="text-sm font-medium">ID Patient</span>
              <Input
                value={formPatientId}
                onChange={(e) => setFormPatientId(e.target.value)}
                placeholder="UUID du patient"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                {}
                <span className="text-sm font-medium">Type d&apos;assurance</span>
                <Select value={formInsType} onValueChange={setFormInsType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSURANCE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {INSURANCE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                {}
                <span className="text-sm font-medium">N° de police</span>
                <Input
                  value={formPolicyNumber}
                  onChange={(e) => setFormPolicyNumber(e.target.value)}
                />
              </div>
            </div>
            <div>
              {}
              <span className="text-sm font-medium">Montant réclamé (MAD)</span>
              <Input
                type="number"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
              />
            </div>
            <div>
              {}
              <span className="text-sm font-medium">Code diagnostic</span>
              <Input value={formDiagnosis} onChange={(e) => setFormDiagnosis(e.target.value)} />
            </div>
            <div>
              {}
              <span className="text-sm font-medium">Description du traitement</span>
              <Input value={formTreatment} onChange={(e) => setFormTreatment(e.target.value)} />
            </div>
            <div>
              {}
              <span className="text-sm font-medium">Notes</span>
              <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            {}
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Annuler
            </Button>
            {}
            <Button onClick={handleCreate}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Claim Dialog */}
      <Dialog open={showUpdate} onOpenChange={setShowUpdate}>
        <DialogContent>
          <DialogHeader>
            {}
            <DialogTitle>Mettre à jour la réclamation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              {}
              <span className="text-sm font-medium">Statut</span>
              <Select value={updateStatus} onValueChange={setUpdateStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              {}
              <span className="text-sm font-medium">N° de réclamation</span>
              <Input
                value={updateClaimNumber}
                onChange={(e) => setUpdateClaimNumber(e.target.value)}
              />
            </div>
            <div>
              {}
              <span className="text-sm font-medium">Montant approuvé (MAD)</span>
              <Input
                type="number"
                step="0.01"
                value={updateAmountApproved}
                onChange={(e) => setUpdateAmountApproved(e.target.value)}
              />
            </div>
            {(updateStatus === "rejected" || updateStatus === "partially_approved") && (
              <div>
                {}
                <span className="text-sm font-medium">Motif de rejet</span>
                <Input
                  value={updateRejectionReason}
                  onChange={(e) => setUpdateRejectionReason(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            {}
            <Button variant="outline" onClick={() => setShowUpdate(false)}>
              Annuler
            </Button>
            {}
            <Button onClick={handleUpdate}>Mettre à jour</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
