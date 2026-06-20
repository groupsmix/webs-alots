/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import {
  Check,
  X,
  Search,
  Filter,
  Crown,
  Building2,
  Stethoscope,
  Pill,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Users,
  Zap,
  Settings,
  Edit,
  Save,
  History,
  Tag,
  Plus,
  Copy,
  Trash2,
  Calendar,
  Percent,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect, useCallback, type ComponentProps } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { systemTypeLabels, tierColors, type SystemType, type TierSlug } from "@/lib/config/pricing";
import { logger } from "@/lib/logger";
import {
  fetchClientSubscriptions,
  fetchPricingTiers,
  fetchFeatureToggles,
  type ClientSubscription,
  type PricingTierRow,
  type FeatureToggleRow,
} from "@/lib/super-admin-actions";
import { formatCurrency, formatNumber } from "@/lib/utils";

type TabView = "tiers" | "features" | "promotions";
type SystemFilter = "all" | SystemType;
type CategoryFilter = "all" | FeatureToggleRow["category"];

interface PriceHistoryEntry {
  date: string;
  system: string;
  cycle: string;
  oldPrice: number;
  newPrice: number;
}

interface Promotion {
  id: string;
  name: string;
  discount: number;
  tiers: string[];
  startDate: string;
  endDate: string;
  enabled: boolean;
}

const STORAGE_KEY_PROMOS = "oltigo_promotions";
const STORAGE_KEY_HISTORY = "oltigo_price_history";

function isPromotion(v: unknown): v is Promotion {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.discount === "number" &&
    Array.isArray(o.tiers) &&
    typeof o.startDate === "string" &&
    typeof o.endDate === "string" &&
    typeof o.enabled === "boolean"
  );
}

function isHistoryEntry(v: unknown): v is PriceHistoryEntry {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.date === "string" &&
    typeof o.system === "string" &&
    typeof o.cycle === "string" &&
    typeof o.oldPrice === "number" &&
    typeof o.newPrice === "number"
  );
}

function loadPromos(): Promotion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROMOS);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPromotion);
  } catch {
    return [];
  }
}

function savePromos(promos: Promotion[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_PROMOS, JSON.stringify(promos));
}

function loadHistory(): PriceHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry);
  } catch {
    return [];
  }
}

function saveHistory(history: PriceHistoryEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
}

const systemIcons: Record<SystemType, typeof Stethoscope> = {
  doctor: Stethoscope,
  dentist: Crown,
  pharmacy: Pill,
};

export default function PricingPage() {
  const { addToast } = useToast();
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

  // Editing state
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPriceMin, setEditPriceMin] = useState("");
  const [editPriceMax, setEditPriceMax] = useState("");
  const [editFeatures, setEditFeatures] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Promotions state
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promoFormOpen, setPromoFormOpen] = useState(false);
  const [promoName, setPromoName] = useState("");
  const [promoDiscount, setPromoDiscount] = useState("");
  const [promoTiers, setPromoTiers] = useState<string[]>([]);
  const [promoStart, setPromoStart] = useState("");
  const [promoEnd, setPromoEnd] = useState("");
  const [deletePromoOpen, setDeletePromoOpen] = useState(false);
  const [deletePromoItem, setDeletePromoItem] = useState<Promotion | null>(null);

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
      logger.warn("Failed to load pricing page", { context: "page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData();
    return () => {
      controller.abort();
    };
  }, [loadData]);

  useEffect(() => {
    setPriceHistory(loadHistory());
    setPromotions(loadPromos());
  }, []);

  const stats = {
    active: subscriptions.filter((s) => s.status === "active").length,
    trial: subscriptions.filter((s) => s.status === "trial").length,
    pastDue: subscriptions.filter((s) => s.status === "past_due").length,
    suspended: subscriptions.filter((s) => s.status === "suspended").length,
    cancelled: subscriptions.filter((s) => s.status === "cancelled").length,
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
    const matchSearch =
      !q || ft.label.toLowerCase().includes(q) || ft.description.toLowerCase().includes(q);
    const matchSystem =
      systemFilter === "all" || ft.systemTypes.includes(systemFilter as SystemType);
    const matchCategory = categoryFilter === "all" || ft.category === categoryFilter;
    return matchSearch && matchSystem && matchCategory;
  });

  function handleToggleFeature(id: string) {
    setToggles((prev) => prev.map((ft) => (ft.id === id ? { ...ft, enabled: !ft.enabled } : ft)));
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
      }),
    );
  }

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case "core":
        return <Building2 className="h-3.5 w-3.5" />;
      case "communication":
        return <Zap className="h-3.5 w-3.5" />;
      case "integration":
        return <Settings className="h-3.5 w-3.5" />;
      case "advanced":
        return <Crown className="h-3.5 w-3.5" />;
      case "pharmacy":
        return <Pill className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  function startEditTier(tier: PricingTierRow) {
    setEditingTierId(tier.id);
    setEditName(tier.name);
    const price = tier.pricing[selectedSystem]?.[billingCycle] ?? 0;
    setEditPriceMin(String(price));
    setEditPriceMax(String(price));
    setEditFeatures(
      tier.features
        .filter((f) => f.included)
        .map((f) => f.label)
        .join("\n"),
    );
  }

  function cancelEditTier() {
    setEditingTierId(null);
  }

  // S9: duplicate a tier so admins can create a new tier based on an existing one
  function duplicateTier(tier: PricingTierRow) {
    // eslint-disable-next-line react-hooks/purity -- ID generated in an event handler, not during render
    const newId = `dup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duplicated: PricingTierRow = {
      ...tier,
      id: newId,
      slug: `${tier.slug}-copie` as TierSlug,
      name: `Copie de ${tier.name}`,
      popular: false, // only one tier can be "Populaire"
    };
    setTiers((prev) => [...prev, duplicated]);
    // immediately enter edit mode so the admin can rename & adjust price
    setEditingTierId(newId);
    setEditName(duplicated.name);
    const price = duplicated.pricing[selectedSystem]?.[billingCycle] ?? 0;
    setEditPriceMin(String(price));
    setEditPriceMax(String(price));
    setEditFeatures(
      duplicated.features
        .filter((f) => f.included)
        .map((f) => f.label)
        .join("\n"),
    );
    addToast(`Tier "Copie de ${tier.name}" créé — modifiez et enregistrez`, "success");
  }

  function requestSaveTier() {
    setConfirmSaveOpen(true);
  }

  function confirmSaveTier() {
    if (!editingTierId) return;

    const oldTier = tiers.find((t) => t.id === editingTierId);
    if (!oldTier) return;

    const oldPrice = oldTier.pricing[selectedSystem]?.[billingCycle] ?? 0;
    const newPrice = Number(editPriceMin) || 0;

    if (oldPrice !== newPrice) {
      const cycleLabel: string = billingCycle === "yearly" ? "yearly" : "monthly";
      const entry: PriceHistoryEntry = {
        date: new Date().toISOString().split("T")[0] ?? "",
        system: systemTypeLabels[selectedSystem],
        cycle: cycleLabel,
        oldPrice: Math.round(oldPrice),
        newPrice: Math.round(newPrice),
      };
      const updated = [entry, ...priceHistory].slice(0, 50);
      setPriceHistory(updated);
      saveHistory(updated);
    }

    setTiers((prev) =>
      prev.map((t) => {
        if (t.id !== editingTierId) return t;
        const newFeatureLabels = editFeatures
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        const updatedFeatures = newFeatureLabels.map((label) => {
          const existing = t.features.find((f) => f.label === label);
          return (
            existing ?? { key: label.toLowerCase().replace(/\s+/g, "_"), label, included: true }
          );
        });
        const removedFeatures = t.features
          .filter((f) => !newFeatureLabels.includes(f.label))
          .map((f) => ({ ...f, included: false }));
        return {
          ...t,
          name: editName,
          pricing: {
            ...t.pricing,
            [selectedSystem]: {
              ...t.pricing[selectedSystem],
              [billingCycle]: Number(editPriceMin) || 0,
            },
          },
          features: [...updatedFeatures, ...removedFeatures],
        };
      }),
    );

    setEditingTierId(null);
    setConfirmSaveOpen(false);
    addToast("Tier updated successfully", "success");
  }

  // Promotion handlers
  function openCreatePromo() {
    setPromoName("");
    setPromoDiscount("");
    setPromoTiers([]);
    setPromoStart("");
    setPromoEnd("");
    setPromoFormOpen(true);
  }

  function handleSavePromo() {
    const newPromo: Promotion = {
      id: `promo-${Date.now()}`,
      name: promoName,
      discount: Number(promoDiscount) || 0,
      tiers: promoTiers,
      startDate: promoStart,
      endDate: promoEnd,
      enabled: true,
    };
    const updated = [newPromo, ...promotions];
    setPromotions(updated);
    savePromos(updated);
    setPromoFormOpen(false);
    addToast("Promotion created", "success");
  }

  function togglePromoEnabled(id: string) {
    const updated = promotions.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
    setPromotions(updated);
    savePromos(updated);
  }

  function handleDeletePromo() {
    if (!deletePromoItem) return;
    const updated = promotions.filter((p) => p.id !== deletePromoItem.id);
    setPromotions(updated);
    savePromos(updated);
    setDeletePromoOpen(false);
    setDeletePromoItem(null);
    addToast("Promotion deleted", "success");
  }

  function togglePromoTier(slug: string) {
    setPromoTiers((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug],
    );
  }

  if (loading) {
    return (
      <div>
        <Breadcrumb
          items={[
            { label: "Super Admin", href: "/super-admin/dashboard" },
            { label: "Pricing & Tiers" },
          ]}
        />
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Pricing & Tiers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage subscription tiers, pricing, and feature toggles for all system types
          </p>
        </div>
        <CardSkeleton count={4} className="mb-6" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Pricing & Tiers" },
        ]}
      />
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
            <p className="text-2xl font-bold">{formatNumber(mrr)}</p>
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
            <p className="text-xs text-muted-foreground">
              {stats.suspended} suspendus, {stats.cancelled} annulés
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={tab === "tiers" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("tiers")}
        >
          <DollarSign className="h-4 w-4 mr-1" />
          Grille tarifaire
        </Button>
        <Button
          variant={tab === "features" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("features")}
        >
          <Settings className="h-4 w-4 mr-1" />
          Feature Toggles
        </Button>
        <Button
          variant={tab === "promotions" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("promotions")}
        >
          <Tag className="h-4 w-4 mr-1" />
          Promotions
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
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  -17%
                </Badge>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryOpen(true)}
                title="Price change history"
              >
                <History className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* S7: Price comparison bar chart — shows tier prices side-by-side for
              the active system type + billing cycle. Helps admins instantly spot
              tier positioning gaps and pricing outliers (e.g. SaaS < Premium). */}
          {(() => {
            const chartData = tiers
              .filter((t) => (t.pricing[selectedSystem]?.[billingCycle] ?? 0) >= 0)
              .map((t) => ({
                name: t.name,
                price: t.pricing[selectedSystem]?.[billingCycle] ?? 0,
                popular: t.popular,
                slug: t.slug,
              }));
            if (chartData.every((d) => d.price === 0)) return null;
            return (
              <div className="rounded-xl border bg-card p-4 mb-6">
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  Comparaison des prix — {systemTypeLabels[selectedSystem]} ·{" "}
                  {billingCycle === "monthly" ? "Mensuel" : "Annuel"}
                </p>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                    barCategoryGap="28%"
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={46}
                      tickFormatter={(v: number) =>
                        v === 0 ? "Gratuit" : `${(v / 1000).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      formatter={
                        ((value: number) => [
                          value === 0 ? "Gratuit" : formatCurrency(value, "fr", "MAD"),
                          "Prix",
                        ]) as unknown as ComponentProps<typeof Tooltip>["formatter"]
                      }
                      labelStyle={{ fontSize: 11 }}
                      contentStyle={{ fontSize: 11 }}
                      cursor={{ fill: "hsl(var(--muted))" }}
                    />
                    <Bar dataKey="price" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={
                            entry.popular ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.45)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted-foreground mt-1 text-right">
                  La barre en couleur pleine = tier <span className="font-medium">Populaire</span>
                </p>
              </div>
            );
          })()}

          {/* Pricing Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {tiers.map((tier) => {
              const price = tier.pricing[selectedSystem]?.[billingCycle] ?? 0;
              const isExpanded = expandedTier === tier.id;
              const isEditing = editingTierId === tier.id;
              const subCount = subscriptions.filter((s) => s.tierSlug === tier.slug).length;

              return (
                <Card
                  key={tier.id}
                  className={`relative ${tier.popular ? "border-primary shadow-md" : ""}`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground text-[10px]">
                        Populaire
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge className={`text-[10px] ${tierColors[tier.slug as TierSlug] ?? ""}`}>
                        {isEditing ? (
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-5 text-[10px] w-20 px-1"
                          />
                        ) : (
                          tier.name
                        )}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">{subCount} clients</span>
                        {!isEditing && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => duplicateTier(tier)}
                              title="Dupliquer ce tier"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => startEditTier(tier)}
                              title="Edit tier"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <div>
                          <Label className="text-[10px]">Price (MAD)</Label>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={editPriceMin}
                              onChange={(e) => setEditPriceMin(e.target.value)}
                              className="h-7 text-xs"
                              placeholder="Min"
                            />
                            <span className="text-xs self-center">-</span>
                            <Input
                              type="number"
                              value={editPriceMax}
                              onChange={(e) => setEditPriceMax(e.target.value)}
                              className="h-7 text-xs"
                              placeholder="Max"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          This tier has {subCount} active clinic{subCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    ) : (
                      <CardTitle className="text-lg mt-2">
                        {price > 0 ? (
                          <>
                            {formatNumber(price)}{" "}
                            <span className="text-sm font-normal text-muted-foreground">
                              MAD/{billingCycle === "monthly" ? "mois" : "an"}
                            </span>
                          </>
                        ) : (
                          // I7-fix: Vitrine is free — display "Gratuit" instead of the
                          // ambiguous "Mensuel uniquement" which gave no price signal.
                          <span className="text-2xl font-bold text-green-600">Gratuit</span>
                        )}
                      </CardTitle>
                    )}
                    {/* S10: Show monthly equivalent when annual billing is selected.
                        Admins comparing annual vs monthly need to see the per-month cost
                        without doing mental arithmetic on the annual figure. */}
                    {!isEditing && billingCycle === "yearly" && price > 0 && (
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 -mt-1">
                        soit {formatNumber(Math.round(price / 12))} MAD/mois
                      </p>
                    )}
                    {!isEditing && (
                      <p className="text-xs text-muted-foreground">{tier.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Separator className="mb-3" />

                    {isEditing ? (
                      <div className="space-y-2">
                        <Label className="text-[10px]">Features (one per line)</Label>
                        <textarea
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={editFeatures}
                          onChange={(e) => setEditFeatures(e.target.value)}
                        />
                        <div className="flex gap-1 mt-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs flex-1"
                            onClick={requestSaveTier}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={cancelEditTier}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Limits */}
                        <div className="space-y-1.5 mb-3 text-xs text-muted-foreground">
                          <p>
                            {tier.limits.maxDoctors === -1 ? (
                              <span className="font-medium text-foreground">
                                Praticiens illimités
                              </span>
                            ) : (
                              <>
                                <span className="font-medium text-foreground">
                                  {tier.limits.maxDoctors}
                                </span>{" "}
                                praticien{tier.limits.maxDoctors !== 1 ? "s" : ""}
                              </>
                            )}
                          </p>
                          <p>
                            {tier.limits.maxPatients === -1 ? (
                              <span className="font-medium text-foreground">
                                Patients illimités
                              </span>
                            ) : (
                              <>
                                <span className="font-medium text-foreground">
                                  {tier.limits.maxPatients === 0
                                    ? "Non inclus"
                                    : tier.limits.maxPatients.toLocaleString()}
                                </span>{" "}
                                {/* I6-fix: "Non inclus" instead of "—" for tiers with 0 patients
                                    (Vitrine). The dash was ambiguous: 0, unlimited, or N/A? */}
                                {tier.limits.maxPatients !== 0 && "patients"}
                              </>
                            )}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">
                              {tier.limits.storageGB}
                            </span>{" "}
                            GB stockage
                          </p>
                        </div>

                        {/* Features */}
                        <button
                          onClick={() => setExpandedTier(isExpanded ? null : tier.id)}
                          className="flex items-center gap-1 text-xs text-primary hover:underline mb-2"
                        >
                          {isExpanded ? "Masquer" : "Voir"} les fonctionnalités
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
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
                                  {f.limit && (
                                    <span className="text-muted-foreground"> ({f.limit})</span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* I3: SaaS Monthly differentiator vs Premium.
                            SaaS costs less (1 499 MAD) but has less storage (50 GB vs 100 GB).
                            Clarify the value proposition to prevent admin confusion. */}
                        {tier.slug === "saas-monthly" && (
                          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[10px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                            <p className="font-semibold mb-0.5">Différent du plan Premium</p>
                            <p>
                              Conçu pour les groupes multi-sites et revendeurs SaaS. Inclut un
                              support dédié, une gestion multi-cabinets et une facturation
                              centralisée — sans les 100 GB de stockage du plan Premium.
                            </p>
                          </div>
                        )}
                      </>
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
              <div className="table-mobile-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium py-3 px-4">Client</th>
                      <th className="text-left font-medium py-3 px-4">Type</th>
                      <th className="text-left font-medium py-3 px-4">Tier</th>
                      <th className="text-left font-medium py-3 px-4 hidden md:table-cell">
                        Cycle
                      </th>
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
                              <span className="capitalize text-muted-foreground">
                                {systemTypeLabels[sub.systemType]}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={`text-[10px] ${tierColors[sub.tierSlug]}`}>
                              {sub.tierName}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 hidden md:table-cell text-muted-foreground capitalize">
                            {sub.billingCycle === "monthly" ? "Mensuel" : "Annuel"}
                          </td>
                          <td className="py-3 px-4 font-medium">{formatCurrency(sub.amount)}</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                sub.status === "active"
                                  ? "success"
                                  : sub.status === "trial"
                                    ? "secondary"
                                    : sub.status === "past_due"
                                      ? "warning"
                                      : "destructive"
                              }
                              className="capitalize"
                            >
                              {sub.status === "past_due"
                                ? "Impayé"
                                : sub.status === "active"
                                  ? "Actif"
                                  : sub.status === "trial"
                                    ? "Essai"
                                    : sub.status === "suspended"
                                      ? "Suspendu"
                                      : "Annulé"}
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
                <Button
                  key={s}
                  variant={systemFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSystemFilter(s)}
                  className="text-xs"
                >
                  {s === "all" ? "Tous" : systemTypeLabels[s as SystemType]}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {(
              [
                "all",
                "core",
                "communication",
                "integration",
                "advanced",
                "pharmacy",
              ] as CategoryFilter[]
            ).map((c) => (
              <Button
                key={c}
                variant={categoryFilter === c ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(c)}
                className="capitalize text-xs"
              >
                {c === "all" ? "Toutes" : c}
              </Button>
            ))}
          </div>

          {/* Feature Toggle Matrix */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">
                Matrice des fonctionnalités ({filteredToggles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="table-mobile-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium py-3 px-4 min-w-[200px]">
                        Fonctionnalité
                      </th>
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
                      <tr
                        key={ft.id}
                        className={`border-b last:border-0 hover:bg-muted/50 ${!ft.enabled ? "opacity-50" : ""}`}
                      >
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
                          <Switch
                            checked={ft.enabled}
                            onCheckedChange={() => handleToggleFeature(ft.id)}
                          />
                        </td>
                        {(
                          ["vitrine", "cabinet", "pro", "premium", "saas-monthly"] as TierSlug[]
                        ).map((tierSlug) => (
                          <td key={tierSlug} className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleTier(ft.id, tierSlug)}
                              disabled={!ft.enabled}
                              className="inline-flex items-center justify-center"
                            >
                              {ft.tiers.includes(tierSlug) ? (
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
                              return (
                                <span key={st} title={systemTypeLabels[st as SystemType]}>
                                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                </span>
                              );
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

      {tab === "promotions" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Promotions & Discounts</h2>
              <p className="text-sm text-muted-foreground">
                Manage promotional offers and discount codes for subscription tiers
              </p>
            </div>
            <Button onClick={openCreatePromo}>
              <Plus className="h-4 w-4 mr-1" />
              New Promotion
            </Button>
          </div>

          {promotions.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <Tag className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">No promotions yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mb-4">
                    Create promotional offers with percentage discounts for specific tiers and time
                    periods.
                  </p>
                  <Button onClick={openCreatePromo}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create your first promotion
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {promotions.map((promo) => {
                const isActive = promo.enabled && new Date(promo.endDate) >= new Date();
                const isExpired = new Date(promo.endDate) < new Date();
                return (
                  <Card key={promo.id} className={!isActive ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
                            <Percent className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-sm">{promo.name}</h3>
                              <Badge variant="secondary" className="text-[10px]">
                                {promo.discount}% off
                              </Badge>
                              {isExpired && (
                                <Badge variant="outline" className="text-[10px]">
                                  Expired
                                </Badge>
                              )}
                              {!promo.enabled && !isExpired && (
                                <Badge variant="outline" className="text-[10px]">
                                  Disabled
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                {promo.tiers.length > 0 ? promo.tiers.join(", ") : "All tiers"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {promo.startDate} → {promo.endDate}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={promo.enabled}
                            onCheckedChange={() => togglePromoEnabled(promo.id)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500"
                            onClick={() => {
                              setDeletePromoItem(promo);
                              setDeletePromoOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Confirm Save Dialog */}
      <Dialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
        <DialogContent onClose={() => setConfirmSaveOpen(false)}>
          <DialogHeader>
            <DialogTitle>Confirm Price Change</DialogTitle>
            <DialogDescription>
              Are you sure you want to update this tier? This change will affect pricing for the
              selected system type and billing cycle.
            </DialogDescription>
          </DialogHeader>
          {editingTierId && (
            <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
              <p className="text-sm font-medium">{editName}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{systemTypeLabels[selectedSystem]}</span>
                <span>&middot;</span>
                <span>{billingCycle === "monthly" ? "Mensuel" : "Annuel"}</span>
              </div>
              <p className="text-sm">
                Nouveau prix :{" "}
                <span className="font-semibold">{formatCurrency(Number(editPriceMin))}</span>
              </p>
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {
                  subscriptions.filter((s) => {
                    const tier = tiers.find((t) => t.id === editingTierId);
                    return tier && s.tierSlug === tier.slug;
                  }).length
                }{" "}
                abonnements actifs seront affectés
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSaveTier}>
              <Save className="h-4 w-4 mr-1" />
              Confirm & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent onClose={() => setHistoryOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Price Change History
            </DialogTitle>
            <DialogDescription>Recent price changes across all tiers.</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[400px] overflow-y-auto">
            {priceHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No price changes recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {priceHistory.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm border-b pb-2 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="font-medium">
                        {formatCurrency(entry.oldPrice)} → {formatCurrency(entry.newPrice)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.system} &middot; {entry.cycle === "monthly" ? "Mensuel" : "Annuel"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{entry.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Promotion Dialog */}
      <Dialog open={promoFormOpen} onOpenChange={setPromoFormOpen}>
        <DialogContent onClose={() => setPromoFormOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Promotion</DialogTitle>
            <DialogDescription>
              Create a new promotional offer with percentage discounts.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Promotion Name</Label>
              <Input
                placeholder="e.g., Summer Sale 2025"
                value={promoName}
                onChange={(e) => setPromoName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Discount Percentage</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="e.g., 20"
                  value={promoDiscount}
                  onChange={(e) => setPromoDiscount(e.target.value)}
                  min="1"
                  max="100"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Applicable Tiers</Label>
              <div className="flex flex-wrap gap-2">
                {(["vitrine", "cabinet", "pro", "premium", "saas-monthly"] as const).map((slug) => (
                  <Button
                    key={slug}
                    type="button"
                    variant={promoTiers.includes(slug) ? "default" : "outline"}
                    size="sm"
                    className="text-xs capitalize"
                    onClick={() => togglePromoTier(slug)}
                  >
                    {slug === "saas-monthly" ? "SaaS" : slug}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {promoTiers.length === 0
                  ? "Applies to all tiers"
                  : `${promoTiers.length} tier(s) selected`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={promoStart}
                  onChange={(e) => setPromoStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={promoEnd} onChange={(e) => setPromoEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePromo}
              disabled={!promoName || !promoDiscount || !promoStart || !promoEnd}
            >
              Create Promotion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Promo Dialog */}
      <Dialog open={deletePromoOpen} onOpenChange={setDeletePromoOpen}>
        {deletePromoItem && (
          <DialogContent onClose={() => setDeletePromoOpen(false)}>
            <DialogHeader>
              <DialogTitle>Delete Promotion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this promotion? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium">{deletePromoItem.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {deletePromoItem.discount}% off &middot; {deletePromoItem.startDate} →{" "}
                {deletePromoItem.endDate}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletePromoOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeletePromo}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
