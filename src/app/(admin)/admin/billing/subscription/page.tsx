"use client";

import {
  CreditCard, Crown, Shield, Zap, Check, X,
  ArrowUpRight, Settings, Loader2, BarChart3,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/components/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import {
  SUBSCRIPTION_PLANS,
  FEATURE_LABELS,
  PLAN_ORDER,
  type PlanSlug,
} from "@/lib/config/subscription-plans";
import { logger } from "@/lib/logger";

interface ClinicSubscriptionInfo {
  plan: PlanSlug;
  status: string;
  appointmentsUsed: number;
  appointmentsLimit: number;
  staffUsed: number;
  staffLimit: number;
  storageUsedGB: number;
  storageLimit: number;
}

async function fetchSubscriptionInfo(clinicId: string): Promise<ClinicSubscriptionInfo> {
  // Fetch clinic config and usage from the API
  const response = await fetch("/api/billing/usage?" + new URLSearchParams({ clinicId }));
  if (response.ok) {
    const json = await response.json();
    if (json.ok) return json.data;
  }

  // Fallback defaults when API is not yet wired
  return {
    plan: "free",
    status: "active",
    appointmentsUsed: 0,
    appointmentsLimit: 5,
    staffUsed: 1,
    staffLimit: 1,
    storageUsedGB: 0,
    storageLimit: 1,
  };
}

export default function SubscriptionBillingPage() {
  const tenant = useTenant();
  const { addToast } = useToast();
  const [subInfo, setSubInfo] = useState<ClinicSubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<PlanSlug | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const info = await fetchSubscriptionInfo(tenant?.clinicId ?? "");
      setSubInfo(info);
    } catch (err) {
      logger.warn("Failed to load subscription info", { context: "subscription-page", error: err });
    } finally {
      setLoading(false);
    }
  }, [tenant?.clinicId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpgrade = async (planId: PlanSlug) => {
    setCheckoutLoading(planId);
    try {
      const response = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const json = await response.json();
      if (json.ok && json.data?.url) {
        window.location.href = json.data.url;
      } else {
        addToast(json.error || "Échec de la création de la session de paiement", "error");
      }
    } catch (err) {
      logger.warn("Checkout failed", { context: "subscription-page", error: err });
      addToast("Erreur lors de la création de la session", "error");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await response.json();
      if (json.ok && json.data?.url) {
        window.location.href = json.data.url;
      } else {
        addToast(json.error || "Échec de l'ouverture du portail", "error");
      }
    } catch (err) {
      logger.warn("Portal session failed", { context: "subscription-page", error: err });
      addToast("Erreur lors de l'ouverture du portail", "error");
    } finally {
      setPortalLoading(false);
    }
  };

  const planIcon = (slug: PlanSlug) => {
    switch (slug) {
      case "free": return <Shield className="h-5 w-5" />;
      case "starter": return <CreditCard className="h-5 w-5" />;
      case "professional": return <Zap className="h-5 w-5" />;
      case "enterprise": return <Crown className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentPlan = subInfo?.plan ?? "free";
  const currentPlanConfig = SUBSCRIPTION_PLANS[currentPlan];
  const currentPlanIndex = PLAN_ORDER.indexOf(currentPlan);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Abonnement</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez votre abonnement et consultez votre utilisation
          </p>
        </div>
        {currentPlan !== "free" && (
          <Button
            variant="outline"
            onClick={handleManageSubscription}
            disabled={portalLoading}
          >
            {portalLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Settings className="h-4 w-4 mr-2" />
            )}
            Gérer l&apos;abonnement
          </Button>
        )}
      </div>

      {/* Current Plan Card */}
      <Card className="mb-6 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              {planIcon(currentPlan)}
              Plan actuel
            </CardTitle>
            <Badge className="text-sm px-3 py-1">
              {currentPlanConfig.name}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Prix</p>
              <p className="text-lg font-bold">
                {currentPlanConfig.price === 0 ? "Gratuit" : `${currentPlanConfig.price} MAD`}
              </p>
              {currentPlanConfig.price > 0 && (
                <p className="text-xs text-muted-foreground">/ mois</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Statut</p>
              <Badge variant={subInfo?.status === "active" ? "success" : subInfo?.status === "past_due" ? "destructive" : "secondary"}>
                {subInfo?.status === "active" ? "Actif" : subInfo?.status === "past_due" ? "Impayé" : subInfo?.status === "cancelled" ? "Annulé" : "Actif"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">IA</p>
              <p className="text-sm font-medium">
                {currentPlanConfig.limits.aiChatbot === false
                  ? "Non inclus"
                  : currentPlanConfig.limits.aiChatbot === "basic"
                    ? "Basique"
                    : currentPlanConfig.limits.aiChatbot === "smart"
                      ? "Intelligent"
                      : "Avancé"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Stockage</p>
              <p className="text-sm font-medium">{currentPlanConfig.limits.storageGB} GB</p>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Usage Stats */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Utilisation ce mois
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <UsageBar
                label="Rendez-vous"
                used={subInfo?.appointmentsUsed ?? 0}
                limit={subInfo?.appointmentsLimit ?? 0}
              />
              <UsageBar
                label="Personnel"
                used={subInfo?.staffUsed ?? 0}
                limit={subInfo?.staffLimit ?? 0}
              />
              <UsageBar
                label="Stockage (GB)"
                used={subInfo?.storageUsedGB ?? 0}
                limit={subInfo?.storageLimit ?? 0}
              />
            </div>
          </div>

          <Separator className="my-4" />

          {/* Features */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Fonctionnalités incluses</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {currentPlanConfig.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <span>{FEATURE_LABELS[feature] ?? feature}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Comparer les plans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLAN_ORDER.map((slug, index) => {
              const plan = SUBSCRIPTION_PLANS[slug];
              const isCurrent = slug === currentPlan;
              const isDowngrade = index < currentPlanIndex;
              const isUpgrade = index > currentPlanIndex;

              return (
                <div
                  key={slug}
                  className={`rounded-lg border p-4 relative ${isCurrent ? "border-primary bg-primary/5" : ""} ${plan.popular ? "ring-1 ring-primary" : ""}`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px]">
                      Populaire
                    </Badge>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    {planIcon(slug)}
                    <h3 className="font-semibold">{plan.name}</h3>
                  </div>
                  <div className="mb-3">
                    <span className="text-2xl font-bold">
                      {plan.price === 0 ? "Gratuit" : `${plan.price}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-sm text-muted-foreground"> MAD/mois</span>
                    )}
                  </div>
                  <Separator className="my-3" />
                  <ul className="space-y-2 mb-4">
                    {plan.features.slice(0, 5).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs">
                        <Check className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                        <span>{FEATURE_LABELS[feature] ?? feature}</span>
                      </li>
                    ))}
                    {plan.features.length > 5 && (
                      <li className="text-xs text-muted-foreground">
                        +{plan.features.length - 5} autres
                      </li>
                    )}
                  </ul>
                  <div className="mt-auto">
                    <p className="text-xs text-muted-foreground mb-2">
                      {plan.limits.appointmentsPerMonth === -1
                        ? "RDV illimités"
                        : `${plan.limits.appointmentsPerMonth} RDV/mois`}
                      {" · "}
                      {plan.limits.staffMembers === -1
                        ? "Personnel illimité"
                        : `${plan.limits.staffMembers} membre(s)`}
                    </p>
                    {isCurrent ? (
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        Plan actuel
                      </Button>
                    ) : isUpgrade ? (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleUpgrade(slug)}
                        disabled={checkoutLoading !== null}
                      >
                        {checkoutLoading === slug ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : null}
                        Upgrader
                      </Button>
                    ) : isDowngrade ? (
                      <Button variant="ghost" size="sm" className="w-full text-muted-foreground" disabled>
                        <X className="h-3.5 w-3.5 mr-1" />
                        Inférieur
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : limit === 0 ? 100 : Math.min((used / limit) * 100, 100);
  const isWarning = !isUnlimited && percentage >= 80;
  const isExceeded = !isUnlimited && percentage >= 100;

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xs font-medium ${isExceeded ? "text-red-600" : isWarning ? "text-yellow-600" : ""}`}>
          {used} / {isUnlimited ? "∞" : limit}
        </p>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isExceeded ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-primary"}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <p className="text-[10px] text-muted-foreground">Illimité</p>
      )}
    </div>
  );
}
