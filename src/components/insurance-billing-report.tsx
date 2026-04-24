"use client";

import {
  Shield, FileText, Download, TrendingUp,
  Clock, CheckCircle, AlertTriangle, Search,
  Filter,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { InsuranceTariffType } from "@/lib/insurance-billing";
import { formatMADFormal } from "@/lib/morocco";

// ---- Types ----

export interface InsuranceClaimRecord {
  id: string;
  patientName: string;
  patientCIN: string;
  affiliationNumber: string;
  insuranceType: InsuranceTariffType;
  dateOfTreatment: string;
  actCodes: string[];
  actDescriptions: string[];
  totalCharged: number;
  totalReimbursement: number;
  patientShare: number;
  depassement: number;
  invoiceNumber: string;
  status: "pending" | "submitted" | "approved" | "paid" | "rejected";
  bordereauRef?: string;
  submittedDate?: string;
  paidDate?: string;
  rejectionReason?: string;
}

interface InsuranceBillingReportProps {
  claims: InsuranceClaimRecord[];
  onGenerateBordereau?: (insuranceType: InsuranceTariffType, claimIds: string[]) => void;
  onDownloadBordereau?: (bordereauRef: string) => void;
}

// ---- Component ----

export function InsuranceBillingReport({
  claims,
  onGenerateBordereau,
  onDownloadBordereau,
}: InsuranceBillingReportProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedClaims, setSelectedClaims] = useState<Set<string>>(new Set());

  // ── Filtered claims ──
  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      const matchesSearch =
        !searchQuery.trim() ||
        claim.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        claim.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        claim.affiliationNumber.includes(searchQuery);

      const matchesStatus =
        statusFilter === "all" || claim.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [claims, searchQuery, statusFilter]);

  // ── Stats by insurance type ──
  const cnssStats = useMemo(() => {
    const cnssClaims = claims.filter((c) => c.insuranceType === "cnss");
    return {
      total: cnssClaims.length,
      totalBilled: cnssClaims.reduce((sum, c) => sum + c.totalReimbursement, 0),
      pending: cnssClaims.filter((c) => c.status === "pending" || c.status === "submitted").length,
      pendingAmount: cnssClaims
        .filter((c) => c.status === "pending" || c.status === "submitted")
        .reduce((sum, c) => sum + c.totalReimbursement, 0),
      paid: cnssClaims.filter((c) => c.status === "paid").length,
      paidAmount: cnssClaims
        .filter((c) => c.status === "paid")
        .reduce((sum, c) => sum + c.totalReimbursement, 0),
      rejected: cnssClaims.filter((c) => c.status === "rejected").length,
    };
  }, [claims]);

  const cnopsStats = useMemo(() => {
    const cnopsClaims = claims.filter((c) => c.insuranceType === "cnops");
    return {
      total: cnopsClaims.length,
      totalBilled: cnopsClaims.reduce((sum, c) => sum + c.totalReimbursement, 0),
      pending: cnopsClaims.filter((c) => c.status === "pending" || c.status === "submitted").length,
      pendingAmount: cnopsClaims
        .filter((c) => c.status === "pending" || c.status === "submitted")
        .reduce((sum, c) => sum + c.totalReimbursement, 0),
      paid: cnopsClaims.filter((c) => c.status === "paid").length,
      paidAmount: cnopsClaims
        .filter((c) => c.status === "paid")
        .reduce((sum, c) => sum + c.totalReimbursement, 0),
      rejected: cnopsClaims.filter((c) => c.status === "rejected").length,
    };
  }, [claims]);

  // ── Selection handlers ──
  const toggleClaim = (id: string) => {
    setSelectedClaims((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      const pendingIds = filteredClaims
        .filter((c) => c.status === "pending")
        .map((c) => c.id);
      setSelectedClaims(new Set(pendingIds));
    } else {
      setSelectedClaims(new Set());
    }
  };

  const handleGenerateBordereau = (insuranceType: InsuranceTariffType) => {
    const selectedIds = [...selectedClaims].filter((id) => {
      const claim = claims.find((c) => c.id === id);
      return claim?.insuranceType === insuranceType && claim?.status === "pending";
    });
    if (selectedIds.length > 0) {
      onGenerateBordereau?.(insuranceType, selectedIds);
      setSelectedClaims(new Set());
    }
  };

  const statusBadge = (status: InsuranceClaimRecord["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="warning" className="text-[10px]">En attente</Badge>;
      case "submitted":
        return <Badge variant="default" className="text-[10px]">Soumis</Badge>;
      case "approved":
        return <Badge variant="outline" className="text-[10px]">Approuvé</Badge>;
      case "paid":
        return <Badge variant="success" className="text-[10px]">Payé</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="text-[10px]">Rejeté</Badge>;
    }
  };

  const statusIcon = (status: InsuranceClaimRecord["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-3.5 w-3.5 text-yellow-600" />;
      case "submitted":
        return <FileText className="h-3.5 w-3.5 text-blue-600" />;
      case "approved":
        return <CheckCircle className="h-3.5 w-3.5 text-indigo-600" />;
      case "paid":
        return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
      case "rejected":
        return <AlertTriangle className="h-3.5 w-3.5 text-red-600" />;
    }
  };

  const renderStatsCards = (
    label: string,
    stats: typeof cnssStats,
    insuranceType: InsuranceTariffType,
  ) => (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Shield className="h-4 w-4" />
        {label}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total facturé</p>
            <p className="text-lg font-bold text-blue-600">
              {formatMADFormal(stats.totalBilled)}
            </p>
            <p className="text-xs text-muted-foreground">{stats.total} dossiers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">En attente</p>
            <p className="text-lg font-bold text-yellow-600">
              {formatMADFormal(stats.pendingAmount)}
            </p>
            <p className="text-xs text-muted-foreground">{stats.pending} dossiers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Reçu</p>
            <p className="text-lg font-bold text-green-600">
              {formatMADFormal(stats.paidAmount)}
            </p>
            <p className="text-xs text-muted-foreground">{stats.paid} dossiers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Rejeté</p>
                <p className="text-lg font-bold text-red-500">{stats.rejected}</p>
              </div>
              {selectedClaims.size > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => handleGenerateBordereau(insuranceType)}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Bordereau
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Rapport Assurance Maladie
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi des remboursements CNSS / CNOPS et g&eacute;n&eacute;ration des bordereaux
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={selectedClaims.size === 0}
            onClick={() => handleGenerateBordereau("cnss")}
          >
            <FileText className="h-4 w-4 mr-1" />
            Bordereau CNSS
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedClaims.size === 0}
            onClick={() => handleGenerateBordereau("cnops")}
          >
            <FileText className="h-4 w-4 mr-1" />
            Bordereau CNOPS
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="space-y-6 mb-6">
        {renderStatsCards("CNSS — Sécurité Sociale (70%)", cnssStats, "cnss")}
        {renderStatsCards("CNOPS — Prévoyance Sociale (80%)", cnopsStats, "cnops")}
      </div>

      <Separator className="my-6" />

      {/* Claims List */}
      <Tabs defaultValue="all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="cnss">CNSS</TabsTrigger>
            <TabsTrigger value="cnops">CNOPS</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher patient, facture..."
                className="pl-10 w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="submitted">Soumis</SelectItem>
                <SelectItem value="approved">Approuvé</SelectItem>
                <SelectItem value="paid">Payé</SelectItem>
                <SelectItem value="rejected">Rejeté</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {["all", "cnss", "cnops"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Dossiers de remboursement
                    <Badge variant="outline" className="text-xs ml-2">
                      {filteredClaims.filter(
                        (c) => tab === "all" || c.insuranceType === tab,
                      ).length}
                    </Badge>
                  </span>
                  <label className="flex items-center gap-2 text-xs font-normal cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                    Sélectionner en attente
                  </label>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredClaims.filter(
                  (c) => tab === "all" || c.insuranceType === tab,
                ).length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="Aucun dossier trouvé"
                    className="py-8"
                  />
                ) : (
                  <div className="space-y-2">
                    {filteredClaims
                      .filter((c) => tab === "all" || c.insuranceType === tab)
                      .map((claim) => (
                        <div
                          key={claim.id}
                          className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                        >
                          {claim.status === "pending" && (
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              checked={selectedClaims.has(claim.id)}
                              onChange={() => toggleClaim(claim.id)}
                            />
                          )}

                          <div className="flex items-center gap-2">
                            {statusIcon(claim.status)}
                            <Badge
                              variant={
                                claim.insuranceType === "cnss"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {claim.insuranceType.toUpperCase()}
                            </Badge>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">
                                {claim.patientName}
                              </p>
                              {statusBadge(claim.status)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {claim.dateOfTreatment} &middot; Facture{" "}
                              {claim.invoiceNumber} &middot; N°{" "}
                              {claim.affiliationNumber}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {claim.actDescriptions.join(", ")}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium">
                              {formatMADFormal(claim.totalReimbursement)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              sur {formatMADFormal(claim.totalCharged)}
                            </p>
                            {claim.depassement > 0 && (
                              <p className="text-[10px] text-amber-600">
                                Dép. {formatMADFormal(claim.depassement)}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-1 shrink-0">
                            {claim.bordereauRef && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Télécharger le bordereau"
                                onClick={() =>
                                  onDownloadBordereau?.(claim.bordereauRef!)
                                }
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Monthly Summary */}
      <div className="mt-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Résumé mensuel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  Total facturé aux assurances
                </p>
                <p className="text-lg font-bold">
                  {formatMADFormal(
                    cnssStats.totalBilled + cnopsStats.totalBilled,
                  )}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  En attente de remboursement
                </p>
                <p className="text-lg font-bold text-yellow-600">
                  {formatMADFormal(
                    cnssStats.pendingAmount + cnopsStats.pendingAmount,
                  )}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  Remboursements reçus
                </p>
                <p className="text-lg font-bold text-green-600">
                  {formatMADFormal(
                    cnssStats.paidAmount + cnopsStats.paidAmount,
                  )}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  Taux de recouvrement
                </p>
                <p className="text-lg font-bold text-blue-600">
                  {cnssStats.totalBilled + cnopsStats.totalBilled > 0
                    ? (
                        ((cnssStats.paidAmount + cnopsStats.paidAmount) /
                          (cnssStats.totalBilled + cnopsStats.totalBilled)) *
                        100
                      ).toFixed(1)
                    : "0.0"}
                  %
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
