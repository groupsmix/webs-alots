"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Check, X, Search, Filter, Crown, Building2,
  Stethoscope, Pill, ChevronDown, ChevronUp,
  DollarSign, Users, Zap, Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import {
  systemTypeLabels,
  tierColors,
  type SystemType,
  type TierSlug,
} from "@/lib/config/pricing";
import { logger } from "@/lib/logger";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import {
  fetchClientSubscriptions,
  fetchPricingTiers,
  fetchFeatureToggles,
  type ClientSubscription,
  type PricingTierRow,
  type FeatureToggleRow,
} from "@/lib/super-admin-actions";

type TabView = "tiers" | "features";
type SystemFilter = "all" | SystemType;
type CategoryFilter = "all" | FeatureToggleRow["category"];

const systemIcons: Record<SystemType, typeof Stethoscope> = {
  doctor: Stethoscope,
  dentist: Crown,
  pharmacy: Pill,
};

export default function PricingPage() {
  const [tab, setTab] = useState<TabView>("tiers");
  const [systemFilter, setSystemFilter] = useState<SystemFilter>("all");
  const [selectedSystem, setSelectedSystem] = useState<SystemType>("doctor");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [featureSearch, setFeatureSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [tiers, setTiers] = useState<PricingTierRow[]>([]);
  const [toggles, setToggles] = useState<FeatureToggleRow[]>([]);
  const [expandedTier, setExpandedTier] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<ClientSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [subs, tiersData, togglesData] = await Promise.all([
        fetchClientSubscriptions(),
        fetchPricingTiers(),
        fetchFeatureToggles(),
      ]);
      setSubscriptions(subs);
      setTiers(tiersData);
      setToggles(togglesData);
    } catch (err) {
      logger.warn("Operation failed", { context: "page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData();
    return () => { controller.abort(); };
  }, [loadData]);

  const stats = {
    active: subscriptions.filter((s) => s.status === "active").length,
    trial: subscriptions.filter((s) => s.status === "trial").length,
    pastDue: subscriptions.filter((s) => s.status === "past_due").length,
    cancelled: subscriptions.filter((s) => s.status === "cancelled" || s.status === "suspended").length,
    total: subscriptions.length,
  };
  const mrr = subscriptions
    .filter((s) => s.status === "active" || s.status === "past_due")
    .reduce((sum, s) => {
      if (s.billingCycle === "yearly") return sum + Math.round(s.amount / 12);
      return sum + s.amount;
    }, 0);

  const filteredToggles = toggles.filter((ft) => {
    const q = featureSearch.toLowerCase();
    const matchSearch = !q || ft.label.toLowerCase().includes(q) || ft.description.toLowerCase().includes(q);
    const matchSystem = systemFilter === "all" || ft.systemTypes.includes(systemFilter as SystemType);
    const matchCategory = categoryFilter === "all" || ft.category === categoryFilter;
    return matchSearch && matchSystem && matchCategory;
  });

  function handleToggleFeature(id: string) {
    setToggles((prev) =>
      prev.map((ft) => (ft.id === id ? { ...ft, enabled: !ft.enabled } : ft))
    );
  }

  function handleToggleTier(featureId: string, tier: TierSlug) {
    setToggles((prev) =>
      prev.map((ft) => {
        if (ft.id !== featureId) return ft;
        const hasTier = ft.tiers.includes(tier);
        return {
          ...ft,
          tiers: hasTier ? ft.tiers.filter((t) => t !== tier) : [...ft.tiers, tier],
        };
      })
    );
  }

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case "core": return <Building2 className="h-3.5 w-3.5" />;
      case "communication": return <Zap className="h-3.5 w-3.5" />;
      case "integration": return <Settings className="h-3.5 w-3.5" />;
      case "advanced": return <Crown className="h-3.5 w-3.5" />;
      case "pharmacy": return <Pill className="h-3.5 w-3.5" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[
        { label: "Super Admin", href: "/super-admin/dashboard" },
        { label: "Pricing & Tiers" },
      ]} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pricing & Tiers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage subscription tiers, pricing, and feature toggles for all system types
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">MRR</span>
            </div>
            <p className="text-2xl font-bold">{mrr.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">MAD / mois</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Abonnés actifs</span>
            </div>
            <p className="text-2xl font-bold">{stats.active}</p>
            <p className="text-xs text-muted-foreground">sur {stats.total} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Essais</span>
            </div>
            <p className="text-2xl font-bold">{stats.trial}</p>
            <p className="text-xs text-muted-foreground">en période d&apos;essai</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <X className="h-4 w-4 text-red-600" />
              <span className="text-xs text-muted-foreground">Impayés</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.pastDue}</p>
            <p className="text-xs text-muted-foreground">{stats.cancelled} annulés</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button variant={tab === "tiers" ? "default" : "outline"} size="sm" onClick={() => setTab("tiers")}>
          <DollarSign className="h-4 w-4 mr-1" />
          Grille tarifaire
        </Button>
        <Button variant={tab === "features" ? "default" : "outline"} size="sm" onClick={() => setTab("features")}>
          <Settings className="h-4 w-4 mr-1" />
          Feature Toggles
        </Button>
      </div>

      {tab === "tiers" && (
        <>
          {/* System Type Selector */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Type :</span>
              {(Object.keys(systemTypeLabels) as SystemType[]).map((type) => {
                const Icon = systemIcons[type];
                return (
                  <Button
                    key={type}
                    variant={selectedSystem === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSystem(type)}
                  >
                    <Icon className="h-4 w-4 mr-1" />
                    {systemTypeLabels[type]}
                  </Button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <span className="text-sm text-muted-foreground">Cycle :</span>
              <Button
                variant={billingCycle === "monthly" ? "default" : "outline"}
                size="sm"
                onClick={() => setBillingCycle("monthly")}
              >
                Mensuel
              </Button>
              <Button
                variant={billingCycle === "yearly" ? "default" : "outline"}
                size="sm"
                onClick={() => setBillingCycle("yearly")}
              >
                Annuel
                <Badge variant="secondary" className="ml-1 text-[10px]">-17%</Badge>
              </Button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {tiers.map((tier) => {
              const price = tier.pricing[selectedSystem][billingCycle];
              const isExpanded = expandedTier === tier.id;
              const subCount = subscriptions.filter((s) => s.tierSlug === tier.slug).length;

              return (
                <Card key={tier.id} className={`relative ${tier.popular ? "border-primary shadow-md" : ""}`}>
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground text-[10px]">Populaire</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge className={`text-[10px] ${tierColors[tier.slug as TierSlug] ?? ""}`}>{tier.name}</Badge>
                      <span className="text-xs text-muted-foreground">{subCount} clients</span>
                    </div>
                    <CardTitle className="text-lg mt-2">
                      {price > 0 ? (
                        <>
                          {price.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">MAD/{billingCycle === "monthly" ? "mois" : "an"}</span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Mensuel uniquement</span>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{tier.description}</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Separator className="mb-3" />

                    {/* Limits */}
                    <div className="space-y-1.5 mb-3 text-xs text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">
                          {tier.limits.maxDoctors === -1 ? "Illimité" : tier.limits.maxDoctors}
                        </span>{" "}
                        praticien{tier.limits.maxDoctors !== 1 ? "s" : ""}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">
                          {tier.limits.maxPatients === -1 ? "Illimité" : tier.limits.maxPatients === 0 ? "—" : tier.limits.maxPatients.toLocaleString()}
                        </span>{" "}
                        patients
                      </p>
                      <p>
                        <span className="font-medium text-foreground">{tier.limits.storageGB}</span> GB stockage
                      </p>
                    </div>

                    {/* Features */}
                    <button
                      onClick={() => setExpandedTier(isExpanded ? null : tier.id)}
                      className="flex items-center gap-1 text-xs text-primary hover:underline mb-2"
                    >
                      {isExpanded ? "Masquer" : "Voir"} les fonctionnalités
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {isExpanded && (
                      <div className="space-y-1.5">
                        {tier.features.map((f) => (
                          <div key={f.key} className="flex items-center gap-2 text-xs">
                            {f.included ? (
                              <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                            )}
                            <span className={f.included ? "" : "text-muted-foreground"}>
                              {f.label}
                              {f.limit && <span className="text-muted-foreground"> ({f.limit})</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Subscription Summary Table */}
          <Card className="mt-6">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Abonnements par tier ({subscriptions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium py-3 px-4">Client</th>
                      <th className="text-left font-medium py-3 px-4">Type</th>
                      <th className="text-left font-medium py-3 px-4">Tier</th>
                      <th className="text-left font-medium py-3 px-4 hidden md:table-cell">Cycle</th>
                      <th className="text-left font-medium py-3 px-4">Montant</th>
                      <th className="text-left font-medium py-3 px-4">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((sub) => {
                      const Icon = systemIcons[sub.systemType];
                      return (
                        <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 px-4 font-medium">{sub.clinicName}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="capitalize text-muted-foreground">{systemTypeLabels[sub.systemType]}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={`text-[10px] ${tierColors[sub.tierSlug]}`}>{sub.tierName}</Badge>
                          </td>
                          <td className="py-3 px-4 hidden md:table-cell text-muted-foreground capitalize">
                            {sub.billingCycle === "monthly" ? "Mensuel" : "Annuel"}
                          </td>
                          <td className="py-3 px-4 font-medium">{sub.amount.toLocaleString()} MAD</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                sub.status === "active" ? "success"
                                : sub.status === "trial" ? "secondary"
                                : sub.status === "past_due" ? "warning"
                                : "destructive"
                              }
                              className="capitalize"
                            >
                              {sub.status === "past_due" ? "Impayé" : sub.status === "active" ? "Actif" : sub.status === "trial" ? "Essai" : sub.status === "suspended" ? "Suspendu" : "Annulé"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {tab === "features" && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une fonctionnalité..."
                className="pl-10"
                value={featureSearch}
                onChange={(e) => setFeatureSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter className="h-4 w-4 text-muted-foreground mr-1" />
              {(["all", "doctor", "dentist", "pharmacy"] as SystemFilter[]).map((s) => (
                <Button key={s} variant={systemFilter === s ? "default" : "outline"} size="sm" onClick={() => setSystemFilter(s)} className="text-xs">
                  {s === "all" ? "Tous" : systemTypeLabels[s as SystemType]}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {(["all", "core", "communication", "integration", "advanced", "pharmacy"] as CategoryFilter[]).map((c) => (
              <Button key={c} variant={categoryFilter === c ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter(c)} className="capitalize text-xs">
                {c === "all" ? "Toutes" : c}
              </Button>
            ))}
          </div>

          {/* Feature Toggle Matrix */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Matrice des fonctionnalités ({filteredToggles.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium py-3 px-4 min-w-[200px]">Fonctionnalité</th>
                      <th className="text-center font-medium py-3 px-4">Global</th>
                      <th className="text-center font-medium py-3 px-4">Vitrine</th>
                      <th className="text-center font-medium py-3 px-4">Cabinet</th>
                      <th className="text-center font-medium py-3 px-4">Pro</th>
                      <th className="text-center font-medium py-3 px-4">Premium</th>
                      <th className="text-center font-medium py-3 px-4">SaaS</th>
                      <th className="text-center font-medium py-3 px-4">Types</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredToggles.map((ft) => (
                      <tr key={ft.id} className={`border-b last:border-0 hover:bg-muted/50 ${!ft.enabled ? "opacity-50" : ""}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {categoryIcon(ft.category)}
                            <div>
                              <p className="font-medium">{ft.label}</p>
                              <p className="text-xs text-muted-foreground">{ft.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Switch checked={ft.enabled} onCheckedChange={() => handleToggleFeature(ft.id)} />
                        </td>
                        {(["vitrine", "cabinet", "pro", "premium", "saas-monthly"] as TierSlug[]).map((tier) => (
                          <td key={tier} className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleTier(ft.id, tier)}
                              disabled={!ft.enabled}
                              className="inline-flex items-center justify-center"
                            >
                              {ft.tiers.includes(tier) ? (
                                <Check className="h-5 w-5 text-green-600" />
                              ) : (
                                <X className="h-5 w-5 text-gray-300" />
                              )}
                            </button>
                          </td>
                        ))}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {ft.systemTypes.map((st) => {
                              const Icon = systemIcons[st as SystemType];
                              return <span key={st} title={systemTypeLabels[st as SystemType]}><Icon className="h-3.5 w-3.5 text-muted-foreground" /></span>;
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredToggles.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground">
                          Aucune fonctionnalité trouvée.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
