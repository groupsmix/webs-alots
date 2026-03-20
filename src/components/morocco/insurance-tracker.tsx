"use client";

import { useState } from "react";
import { Shield, Calculator, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INSURANCE_PROVIDERS,
  calculateResteACharge,
  formatMAD,
  type PatientInsurance,
  type MoroccanInsuranceType,
} from "@/lib/morocco";

interface InsuranceTrackerProps {
  patientName: string;
  insurance?: PatientInsurance;
  onUpdateInsurance?: (insurance: PatientInsurance) => void;
  /** If provided, shows the cost calculation */
  serviceAmount?: number;
  readOnly?: boolean;
}

/**
 * InsuranceTracker
 *
 * Tracks patient insurance (CNSS/CNOPS/AMO/Mutuelle) and calculates
 * coverage (reste à charge) for Moroccan patients.
 */
export function InsuranceTracker({
  patientName,
  insurance,
  onUpdateInsurance,
  serviceAmount,
  readOnly = false,
}: InsuranceTrackerProps) {
  const [isEditing, setIsEditing] = useState(!insurance);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [primaryType, setPrimaryType] = useState<MoroccanInsuranceType>(
    insurance?.primaryInsurance ?? "cnss"
  );
  const [primaryId, setPrimaryId] = useState(insurance?.primaryInsuranceId ?? "cnss");
  const [affiliationNumber, setAffiliationNumber] = useState(insurance?.affiliationNumber ?? "");
  const [hasMutuelle, setHasMutuelle] = useState(!!insurance?.mutuelle);
  const [mutuelleName, setMutuelleName] = useState(insurance?.mutuelle?.name ?? "");
  const [mutuelleNumber, setMutuelleNumber] = useState(
    insurance?.mutuelle?.registrationNumber ?? ""
  );
  const [mutuelleCoverage, setMutuelleCoverage] = useState(
    insurance?.mutuelle?.coverageRate?.toString() ?? "50"
  );

  const selectedProvider = INSURANCE_PROVIDERS.find((p) => p.id === primaryId);

  const currentInsurance: PatientInsurance = {
    primaryInsurance: primaryType,
    primaryInsuranceId: primaryId,
    affiliationNumber,
    mutuelle: hasMutuelle
      ? {
          name: mutuelleName,
          registrationNumber: mutuelleNumber,
          coverageRate: parseInt(mutuelleCoverage) || 50,
        }
      : undefined,
  };

  const coverage =
    serviceAmount && selectedProvider
      ? calculateResteACharge(serviceAmount, currentInsurance)
      : null;

  const handleSave = () => {
    onUpdateInsurance?.(currentInsurance);
    setIsEditing(false);
  };

  // Filter providers by type
  const filteredProviders = INSURANCE_PROVIDERS.filter((p) => {
    if (primaryType === "cnss") return p.type === "cnss";
    if (primaryType === "cnops") return p.type === "cnops";
    if (primaryType === "amo") return p.type === "amo";
    if (primaryType === "ramed") return p.type === "ramed";
    if (primaryType === "private") return p.type === "private";
    return true;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            Assurance — {patientName}
          </CardTitle>
          {insurance && !readOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? "Annuler" : "Modifier"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current insurance display */}
        {insurance && !isEditing && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div>
                <p className="text-sm font-medium">{selectedProvider?.name ?? insurance.primaryInsurance.toUpperCase()}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedProvider?.nameFr}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  N° Affiliation: {insurance.affiliationNumber}
                </p>
              </div>
              <Badge variant="default" className="text-xs">
                {selectedProvider?.coverageRate ?? 0}% couvert
              </Badge>
            </div>

            {insurance.mutuelle && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <div>
                  <p className="text-sm font-medium">Mutuelle: {insurance.mutuelle.name}</p>
                  <p className="text-xs text-muted-foreground">
                    N° {insurance.mutuelle.registrationNumber}
                  </p>
                </div>
                <Badge variant="success" className="text-xs">
                  +{insurance.mutuelle.coverageRate}% complémentaire
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Edit form */}
        {isEditing && !readOnly && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type d&apos;assurance</Label>
              <Select
                value={primaryType}
                onValueChange={(v) => {
                  const type = v as MoroccanInsuranceType;
                  setPrimaryType(type);
                  // Auto-select first matching provider
                  const match = INSURANCE_PROVIDERS.find((p) => p.type === type);
                  if (match) setPrimaryId(match.id);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cnss">CNSS (Secteur privé)</SelectItem>
                  <SelectItem value="cnops">CNOPS (Secteur public)</SelectItem>
                  <SelectItem value="amo">AMO</SelectItem>
                  <SelectItem value="ramed">RAMED</SelectItem>
                  <SelectItem value="private">Assurance privée</SelectItem>
                  <SelectItem value="none">Sans assurance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {primaryType !== "none" && (
              <>
                {filteredProviders.length > 1 && (
                  <div className="space-y-2">
                    <Label>Organisme</Label>
                    <Select value={primaryId} onValueChange={setPrimaryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredProviders.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} — {p.coverageRate}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>N° d&apos;affiliation</Label>
                  <Input
                    placeholder="Ex: 123456789"
                    value={affiliationNumber}
                    onChange={(e) => setAffiliationNumber(e.target.value)}
                  />
                </div>

                {/* Mutuelle section */}
                <div className="border-t pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasMutuelle}
                      onChange={(e) => setHasMutuelle(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium">A une mutuelle complémentaire</span>
                  </label>

                  {hasMutuelle && (
                    <div className="mt-3 space-y-3 pl-6">
                      <div className="space-y-2">
                        <Label>Nom de la mutuelle</Label>
                        <Input
                          placeholder="Ex: Mutuelle des Enseignants"
                          value={mutuelleName}
                          onChange={(e) => setMutuelleName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>N° d&apos;adhérent</Label>
                        <Input
                          placeholder="Ex: MUT-12345"
                          value={mutuelleNumber}
                          onChange={(e) => setMutuelleNumber(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Taux de couverture complémentaire (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={mutuelleCoverage}
                          onChange={(e) => setMutuelleCoverage(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button onClick={handleSave} className="w-full" size="sm">
                  Enregistrer l&apos;assurance
                </Button>
              </>
            )}
          </div>
        )}

        {/* Cost breakdown */}
        {coverage && serviceAmount && (
          <div className="border-t pt-4">
            <button
              className="flex items-center justify-between w-full text-sm font-medium"
              onClick={() => setShowBreakdown(!showBreakdown)}
            >
              <span className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-orange-600" />
                Détail de prise en charge
              </span>
              {showBreakdown ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showBreakdown && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant total</span>
                  <span className="font-medium">{formatMAD(coverage.totalAmount)}</span>
                </div>
                {coverage.insuranceCovered > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Prise en charge {selectedProvider?.name}</span>
                    <span>- {formatMAD(coverage.insuranceCovered)}</span>
                  </div>
                )}
                {coverage.mutuelleCovered > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Prise en charge mutuelle</span>
                    <span>- {formatMAD(coverage.mutuelleCovered)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Reste à charge patient</span>
                  <span className="text-orange-600">{formatMAD(coverage.resteACharge)}</span>
                </div>
                {coverage.coverageBreakdown && (
                  <p className="text-xs text-muted-foreground">
                    Couverture: {coverage.coverageBreakdown}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick actions */}
        {insurance && !isEditing && (
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Feuille de soins
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
