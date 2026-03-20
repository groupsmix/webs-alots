"use client";

import { useState } from "react";
import {
  CreditCard, Receipt, Download, CheckCircle, Clock,
  AlertTriangle, ArrowUpRight, Crown, Shield, Zap,
  Check, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  pricingTiers,
  clientSubscriptions,
  tierColors,
  type TierSlug,
} from "@/lib/pricing-data";

// Simulate the current client's subscription (Cabinet Dr. Ahmed Benali = premium)
const currentSub = clientSubscriptions[0];
const currentTier = pricingTiers.find((t) => t.slug === currentSub.tierSlug)!;

export default function ClientBillingPage() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedUpgrade, setSelectedUpgrade] = useState<TierSlug | null>(null);

  const statusIcon = (status: string) => {
    switch (status) {
      case "paid": return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
      case "pending": return <Clock className="h-3.5 w-3.5 text-yellow-600" />;
      case "overdue": return <AlertTriangle className="h-3.5 w-3.5 text-red-600" />;
      default: return <Clock className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  const tierIcon = (slug: TierSlug) => {
    switch (slug) {
      case "vitrine": return <Shield className="h-5 w-5" />;
      case "cabinet": return <CreditCard className="h-5 w-5" />;
      case "pro": return <Zap className="h-5 w-5" />;
      case "premium": return <Crown className="h-5 w-5" />;
      default: return <CreditCard className="h-5 w-5" />;
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Facturation & Abonnement</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez votre abonnement, consultez vos factures et mettez à niveau votre plan
          </p>
        </div>
      </div>

      {/* Current Plan */}
      <Card className="mb-6 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              {tierIcon(currentSub.tierSlug)}
              Votre plan actuel
            </CardTitle>
            <Badge className={`${tierColors[currentSub.tierSlug]} text-sm px-3 py-1`}>
              {currentTier.name}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Montant</p>
              <p className="text-lg font-bold">{currentSub.amount.toLocaleString()} MAD</p>
              <p className="text-xs text-muted-foreground">/ {currentSub.billingCycle === "monthly" ? "mois" : "an"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Statut</p>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-600">Actif</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Période</p>
              <p className="text-sm font-medium">{currentSub.currentPeriodStart}</p>
              <p className="text-xs text-muted-foreground">au {currentSub.currentPeriodEnd}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Paiement</p>
              <p className="text-sm font-medium">{currentSub.paymentMethod}</p>
              <p className="text-xs text-muted-foreground">
                Renouvellement {currentSub.autoRenew ? "automatique" : "manuel"}
              </p>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Current plan features */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Fonctionnalités incluses</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {currentTier.features.map((f) => (
                <div key={f.key} className="flex items-center gap-2 text-sm">
                  {f.included ? (
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-gray-300 shrink-0" />
                  )}
                  <span className={f.included ? "" : "text-muted-foreground"}>
                    {f.label}
                    {f.limit && <span className="text-muted-foreground text-xs"> ({f.limit})</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Limits */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Praticiens</p>
              <p className="text-lg font-bold">
                {currentTier.limits.maxDoctors === -1 ? "Illimité" : currentTier.limits.maxDoctors}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Patients max</p>
              <p className="text-lg font-bold">
                {currentTier.limits.maxPatients === -1 ? "Illimité" : currentTier.limits.maxPatients.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">RDV / mois</p>
              <p className="text-lg font-bold">
                {currentTier.limits.maxAppointmentsPerMonth === -1 ? "Illimité" : currentTier.limits.maxAppointmentsPerMonth.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Stockage</p>
              <p className="text-lg font-bold">{currentTier.limits.storageGB} GB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Invoice History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Historique des factures
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentSub.invoices.length > 0 ? (
              <div className="space-y-3">
                {currentSub.invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      {statusIcon(inv.status)}
                      <div>
                        <p className="text-sm font-medium">{inv.amount.toLocaleString()} MAD</p>
                        <p className="text-xs text-muted-foreground">{inv.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "destructive" : "warning"} className="text-[10px]">
                        {inv.status === "paid" ? "Payé" : inv.status === "overdue" ? "Impayé" : "En attente"}
                      </Badge>
                      <Button variant="ghost" size="sm" title="Télécharger">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Aucune facture</p>
            )}
          </CardContent>
        </Card>

        {/* Upgrade Options */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4" />
              Comparer les plans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pricingTiers
                .filter((t) => t.slug !== "saas-monthly")
                .map((tier) => {
                  const isCurrent = tier.slug === currentSub.tierSlug;
                  const price = tier.pricing[currentSub.systemType].monthly;
                  return (
                    <div
                      key={tier.id}
                      className={`flex items-center justify-between rounded-lg border p-3 ${isCurrent ? "border-primary bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        {tierIcon(tier.slug)}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{tier.name}</p>
                            {isCurrent && <Badge variant="default" className="text-[10px]">Actuel</Badge>}
                            {tier.popular && !isCurrent && <Badge variant="secondary" className="text-[10px]">Populaire</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{tier.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{price.toLocaleString()} MAD</p>
                        <p className="text-[10px] text-muted-foreground">/ mois</p>
                        {!isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1 text-xs"
                            onClick={() => { setSelectedUpgrade(tier.slug); setUpgradeOpen(true); }}
                          >
                            {pricingTiers.indexOf(tier) > pricingTiers.findIndex((t) => t.slug === currentSub.tierSlug) ? "Upgrader" : "Changer"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Dialog */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        {selectedUpgrade && (() => {
          const upgradeTier = pricingTiers.find((t) => t.slug === selectedUpgrade);
          if (!upgradeTier) return null;
          const newPrice = upgradeTier.pricing[currentSub.systemType].monthly;
          return (
            <DialogContent onClose={() => setUpgradeOpen(false)}>
              <DialogHeader>
                <DialogTitle>Changer de plan</DialogTitle>
                <DialogDescription>
                  Passer du plan {currentTier.name} au plan {upgradeTier.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Plan actuel</p>
                    <p className="font-medium">{currentTier.name}</p>
                    <p className="text-sm text-muted-foreground">{currentSub.amount.toLocaleString()} MAD/mois</p>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Nouveau plan</p>
                    <p className="font-medium">{upgradeTier.name}</p>
                    <p className="text-sm font-bold text-primary">{newPrice.toLocaleString()} MAD/mois</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Nouvelles fonctionnalités</h4>
                  <div className="space-y-1.5">
                    {upgradeTier.features
                      .filter((f) => f.included && !currentTier.features.find((cf) => cf.key === f.key)?.included)
                      .map((f) => (
                        <div key={f.key} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-600" />
                          <span>{f.label}</span>
                        </div>
                      ))}
                    {upgradeTier.features
                      .filter((f) => f.included && !currentTier.features.find((cf) => cf.key === f.key)?.included)
                      .length === 0 && (
                      <p className="text-sm text-muted-foreground">Mêmes fonctionnalités</p>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUpgradeOpen(false)}>Annuler</Button>
                <Button onClick={() => setUpgradeOpen(false)}>
                  <Crown className="h-4 w-4 mr-1" />
                  Confirmer le changement
                </Button>
              </DialogFooter>
            </DialogContent>
          );
        })()}
      </Dialog>
    </div>
  );
}
