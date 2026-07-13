"use client";

import {
  CreditCard,
  Receipt,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Crown,
  Shield,
  Zap,
  Check,
  X,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { Suspense, use, useState } from "react";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { tierColors, type SubscriptionPlan, type SystemType } from "@/lib/config/pricing";
import {
  fetchActivePricingTiers,
  fetchClinicSubscription,
  type ClinicSubscriptionView,
} from "@/lib/data/client";
import { t } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import type { PricingTierRow } from "@/lib/super-admin/types";
import { formatCurrency, formatNumber } from "@/lib/utils";

async function loadBillingData(clinicId: string): Promise<{
  currentSub: ClinicSubscriptionView | null;
  allTiers: PricingTierRow[];
  error: string | null;
}> {
  try {
    const [sub, tiers] = await Promise.all([
      fetchClinicSubscription(clinicId),
      fetchActivePricingTiers(),
    ]);
    return { currentSub: sub, allTiers: tiers, error: null };
  } catch (err) {
    logger.warn("Failed to load admin billing page", { context: "page", error: err });
    return { currentSub: null, allTiers: [], error: "Impossible de charger la facturation" };
  }
}

function BillingContent() {
  const [locale] = useLocale();
  const tenant = useTenant();
  const clinicId = tenant?.clinicId ?? "";
  const [promise] = useState(() => loadBillingData(clinicId));
  const result = use(promise);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedUpgrade, setSelectedUpgrade] = useState<SubscriptionPlan | null>(null);

  const statusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
      case "pending":
        return <Clock className="h-3.5 w-3.5 text-yellow-600" />;
      case "overdue":
        return <AlertTriangle className="h-3.5 w-3.5 text-red-600" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  const tierIcon = (slug: string) => {
    switch (slug) {
      case "free":
        return <Shield className="h-5 w-5" />;
      case "starter":
        return <CreditCard className="h-5 w-5" />;
      case "professional":
        return <Zap className="h-5 w-5" />;
      case "enterprise":
        return <Crown className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  const { currentSub, allTiers, error } = result;

  if (error) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="mb-2">{error}</p>
        <p className="text-sm">Veuillez réessayer plus tard.</p>
      </div>
    );
  }

  if (!currentSub) {
    const systemType = (tenant?.clinicType ?? "doctor") as SystemType;
    const availableTiers = allTiers.filter((tier) => tier.slug !== "enterprise");
    return (
      <div>
        <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Billing" }]} />
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t(locale, "admin.billing.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(locale, "admin.billing.gerezVotreAbonnementConsultez")}
          </p>
        </div>

        <Card className="border-primary/20">
          <CardContent className="py-10 px-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">
              {t(locale, "admin.billing.noActiveSubscription")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
              {t(locale, "admin.billing.noSubscriptionDescription")}
            </p>
          </CardContent>
        </Card>

        {availableTiers.length > 0 && (
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4" />
                {t(locale, "admin.billing.availablePlans")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {availableTiers.map((tier) => {
                  const price = tier.pricing[systemType]?.monthly ?? 0;
                  return (
                    <div
                      key={tier.id}
                      className={`rounded-lg border p-4 ${tier.popular ? "border-primary bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        {tierIcon(tier.slug)}
                        <p className="text-sm font-medium">{tier.name}</p>
                        {tier.popular && (
                          <Badge variant="secondary" className="text-[10px]">
                            Populaire
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-lg font-bold">
                        {formatCurrency(
                          price,
                          typeof locale !== "undefined" ? locale : "fr",
                          "MAD",
                        )}
                        <span className="text-xs font-normal text-muted-foreground"> / mois</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const currentTier = currentSub.tier;

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Billing" }]} />
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
              {tierIcon(currentSub.SubscriptionPlan)}
              Votre plan actuel
            </CardTitle>
            <Badge
              className={`${tierColors[currentSub.SubscriptionPlan as SubscriptionPlan] ?? ""} text-sm px-3 py-1`}
            >
              {currentSub.tierName}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Montant</p>
              <p className="text-lg font-bold">
                {formatCurrency(
                  currentSub.amount,
                  typeof locale !== "undefined" ? locale : "fr",
                  "MAD",
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                / {currentSub.billingCycle === "monthly" ? "mois" : "an"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Statut</p>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-600">
                  {currentSub.status === "active"
                    ? "Actif"
                    : currentSub.status === "trial"
                      ? "Essai"
                      : currentSub.status === "past_due"
                        ? "Impayé"
                        : currentSub.status === "suspended"
                          ? "Suspendu"
                          : "Annulé"}
                </span>
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

          {currentTier && (
            <>
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
                        {f.limit && (
                          <span className="text-muted-foreground text-xs"> ({f.limit})</span>
                        )}
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
                    {currentTier.limits.maxDoctors === -1
                      ? "Illimité"
                      : currentTier.limits.maxDoctors}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Patients max</p>
                  <p className="text-lg font-bold">
                    {currentTier.limits.maxPatients === -1
                      ? "Illimité"
                      : formatNumber(
                          currentTier.limits.maxPatients,
                          typeof locale !== "undefined" ? locale : "fr",
                        )}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">RDV / mois</p>
                  <p className="text-lg font-bold">
                    {currentTier.limits.maxAppointmentsPerMonth === -1
                      ? "Illimité"
                      : formatNumber(
                          currentTier.limits.maxAppointmentsPerMonth,
                          typeof locale !== "undefined" ? locale : "fr",
                        )}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Stockage</p>
                  <p className="text-lg font-bold">{currentTier.limits.storageGB} GB</p>
                </div>
              </div>
            </>
          )}
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
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {statusIcon(inv.status)}
                      <div>
                        <p className="text-sm font-medium">
                          {formatCurrency(
                            inv.amount,
                            typeof locale !== "undefined" ? locale : "fr",
                            "MAD",
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{inv.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          inv.status === "paid"
                            ? "success"
                            : inv.status === "overdue"
                              ? "destructive"
                              : "warning"
                        }
                        className="text-[10px]"
                      >
                        {inv.status === "paid"
                          ? "Payé"
                          : inv.status === "overdue"
                            ? "Impayé"
                            : "En attente"}
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
              {allTiers
                .filter((t) => t.slug !== "enterprise")
                .map((tier) => {
                  const isCurrent = tier.slug === currentSub.SubscriptionPlan;
                  const pricing = tier.pricing[currentSub.systemType];
                  const price = pricing?.monthly ?? 0;
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
                            {isCurrent && (
                              <Badge variant="default" className="text-[10px]">
                                Actuel
                              </Badge>
                            )}
                            {tier.popular && !isCurrent && (
                              <Badge variant="secondary" className="text-[10px]">
                                Populaire
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{tier.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          {formatCurrency(
                            price,
                            typeof locale !== "undefined" ? locale : "fr",
                            "MAD",
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground">/ mois</p>
                        {!isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1 text-xs"
                            onClick={() => {
                              setSelectedUpgrade(tier.slug as SubscriptionPlan);
                              setUpgradeOpen(true);
                            }}
                          >
                            {allTiers.indexOf(tier) >
                            allTiers.findIndex((t) => t.slug === currentSub.SubscriptionPlan)
                              ? "Upgrader"
                              : "Changer"}
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
        {selectedUpgrade &&
          (() => {
            const upgradeTier = allTiers.find((t) => t.slug === selectedUpgrade);
            if (!upgradeTier) return null;
            const newPrice = upgradeTier.pricing[currentSub.systemType]?.monthly ?? 0;
            return (
              <DialogContent onClose={() => setUpgradeOpen(false)}>
                <DialogHeader>
                  <DialogTitle>Changer de plan</DialogTitle>
                  <DialogDescription>
                    Passer du plan {currentSub.tierName} au plan {upgradeTier.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Plan actuel</p>
                      <p className="font-medium">{currentSub.tierName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(
                          currentSub.amount,
                          typeof locale !== "undefined" ? locale : "fr",
                          "MAD",
                        )}
                        /mois
                      </p>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Nouveau plan</p>
                      <p className="font-medium">{upgradeTier.name}</p>
                      <p className="text-sm font-bold text-primary">
                        {formatCurrency(
                          newPrice,
                          typeof locale !== "undefined" ? locale : "fr",
                          "MAD",
                        )}
                        /mois
                      </p>
                    </div>
                  </div>
                  {currentTier && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Nouvelles fonctionnalités</h4>
                      <div className="space-y-1.5">
                        {upgradeTier.features
                          .filter(
                            (f) =>
                              f.included &&
                              !currentTier.features.find((cf) => cf.key === f.key)?.included,
                          )
                          .map((f) => (
                            <div key={f.key} className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-600" />
                              <span>{f.label}</span>
                            </div>
                          ))}
                        {upgradeTier.features.filter(
                          (f) =>
                            f.included &&
                            !currentTier.features.find((cf) => cf.key === f.key)?.included,
                        ).length === 0 && (
                          <p className="text-sm text-muted-foreground">Mêmes fonctionnalités</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUpgradeOpen(false)}>
                    Annuler
                  </Button>
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

export default function ClientBillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
