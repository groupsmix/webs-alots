"use client";

/**
 * AI Model Routing Dashboard — Track 4
 *
 * Shows the live state of the intelligent model routing system:
 * provider health, priority order, budget consumption, fallback chains,
 * and cost-per-task breakdown.
 */

import {
  Activity,
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  DollarSign,
  RefreshCw,
  TrendingDown,
  Shield,
} from "lucide-react";
import { Suspense, use, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";

interface ProviderConfig {
  provider: string;
  display_name: string;
  routing_tier: number;
  is_active: boolean;
  has_api_key: boolean;
  cost_this_month_cents: number;
  monthly_budget_cents: number;
  rate_limited_until: string | null;
  last_error: string | null;
  requests_this_month: number;
  tokens_this_month: number;
}

interface RoutingData {
  providers: ProviderConfig[];
  toggles: Array<{ feature_key: string; display_name: string; is_enabled: boolean }>;
  usage: Record<string, { requests: number; tokens: number; costCents: number; errors: number }>;
}

const PROVIDER_ICONS: Record<string, string> = {
  anthropic: "🧠",
  openai: "🤖",
  google: "✨",
  xai: "🚀",
  mistral: "🌊",
  deepseek: "🔍",
  groq: "⚡",
  workers_ai: "☁️",
};

const TIER_NAMES = ["Free", "Economy", "Standard", "Premium"];

function ProviderStatusIcon({
  isActive,
  hasApiKey,
  isRateLimited,
}: {
  isActive: boolean;
  hasApiKey: boolean;
  isRateLimited: boolean;
}) {
  if (isRateLimited) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (!hasApiKey) return <XCircle className="h-4 w-4 text-red-400" />;
  if (!isActive) return <XCircle className="h-4 w-4 text-muted-foreground" />;
  return <CheckCircle className="h-4 w-4 text-green-500" />;
}

function formatMAD(cents: number) {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

async function fetchRoutingData(): Promise<{ data: RoutingData | null; error: string | null }> {
  try {
    const res = await fetch("/api/admin/ai-config", { credentials: "include" });
    if (!res.ok) throw new Error("Chargement échoué");
    const json = (await res.json()) as { data?: RoutingData };
    if (!json.data) throw new Error("Aucune donnée");
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Erreur inconnue" };
  }
}

function ModelRoutingContent() {
  const [promise, setPromise] = useState(() => fetchRoutingData());
  const result = use(promise);
  const { data, error } = result;

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-muted-foreground">{error ?? "Aucune donnée"}</p>
        <Button variant="outline" onClick={() => setPromise(fetchRoutingData())}>
          Réessayer
        </Button>
      </div>
    );
  }

  // Sort providers by routing_tier DESC (highest quality first), workers_ai always last
  const sortedProviders = [...data.providers].sort((a, b) => {
    if (a.provider === "workers_ai") return 1;
    if (b.provider === "workers_ai") return -1;
    return b.routing_tier - a.routing_tier;
  });

  // Determine which provider would be selected now (first active, has key, not rate-limited, not over budget)
  const activeProvider = sortedProviders.find((p) => {
    if (!p.is_active || !p.has_api_key) return false;
    if (p.rate_limited_until && new Date(p.rate_limited_until) > new Date()) return false;
    if (p.monthly_budget_cents > 0 && p.cost_this_month_cents >= p.monthly_budget_cents)
      return false;
    return true;
  });

  const totalCost = data.providers.reduce((s, p) => s + p.cost_this_month_cents, 0);
  const totalRequests = data.providers.reduce((s, p) => s + p.requests_this_month, 0);
  const totalTokens = data.providers.reduce((s, p) => s + p.tokens_this_month, 0);
  const failedProviders = data.providers.filter(
    (p) =>
      p.has_api_key &&
      (!p.is_active || (p.rate_limited_until && new Date(p.rate_limited_until) > new Date())),
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-violet-600" />
            Routage Intelligent IA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Surveillance en temps réel du système de sélection de modèles IA
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPromise(fetchRoutingData())}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Current active provider */}
      <Card className="border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-xl">
              {activeProvider ? (PROVIDER_ICONS[activeProvider.provider] ?? "🤖") : "⚠️"}
            </div>
            <div>
              <p className="text-xs text-violet-600 dark:text-violet-400 font-medium uppercase tracking-wide">
                Fournisseur sélectionné actuellement
              </p>
              <p className="font-bold text-lg">
                {activeProvider ? activeProvider.display_name : "Aucun fournisseur disponible"}
              </p>
              {activeProvider && (
                <p className="text-xs text-muted-foreground">
                  Tier {activeProvider.routing_tier} — {TIER_NAMES[activeProvider.routing_tier]}
                </p>
              )}
            </div>
            {!activeProvider && (
              <Badge variant="destructive" className="ml-auto">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Dégradé
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Coût total (mois)",
            value: formatMAD(totalCost),
            icon: DollarSign,
            color: "text-blue-500",
          },
          {
            label: "Total requêtes",
            value: totalRequests.toLocaleString("fr-MA"),
            icon: Zap,
            color: "text-violet-500",
          },
          {
            label: "Total tokens",
            value: `${(totalTokens / 1000).toFixed(1)}k`,
            icon: Activity,
            color: "text-green-500",
          },
          {
            label: "Fournisseurs dégradés",
            value: failedProviders.toString(),
            icon: TrendingDown,
            color: failedProviders > 0 ? "text-red-500" : "text-muted-foreground",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-5 w-5 shrink-0 ${color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold text-sm">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Routing Priority Chain */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-violet-600" />
            Chaîne de Priorité de Routage
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Les requêtes sont envoyées au premier fournisseur disponible par ordre de priorité
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedProviders.map((provider, idx) => {
              const usage = data.usage[provider.provider];
              const isRateLimited = !!(
                provider.rate_limited_until && new Date(provider.rate_limited_until) > new Date()
              );
              const isBudgetExceeded =
                provider.monthly_budget_cents > 0 &&
                provider.cost_this_month_cents >= provider.monthly_budget_cents;
              const isCurrentlySelected = provider.provider === activeProvider?.provider;
              const budgetPct =
                provider.monthly_budget_cents > 0
                  ? Math.round(
                      (provider.cost_this_month_cents / provider.monthly_budget_cents) * 100,
                    )
                  : 0;

              return (
                <div key={provider.provider}>
                  <div
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                      isCurrentlySelected
                        ? "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30"
                        : "border-muted"
                    }`}
                  >
                    {/* Priority number */}
                    <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">
                      #{idx + 1}
                    </span>

                    {/* Icon */}
                    <span className="text-lg shrink-0">
                      {PROVIDER_ICONS[provider.provider] ?? "🤖"}
                    </span>

                    {/* Name and tier */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{provider.display_name}</p>
                        {isCurrentlySelected && (
                          <Badge className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                            ← Actif
                          </Badge>
                        )}
                        {isRateLimited && (
                          <Badge variant="destructive" className="text-[10px]">
                            Rate limited
                          </Badge>
                        )}
                        {isBudgetExceeded && (
                          <Badge variant="destructive" className="text-[10px]">
                            Budget dépassé
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-[10px] text-muted-foreground">
                          Tier {provider.routing_tier} — {TIER_NAMES[provider.routing_tier]}
                        </p>
                        {usage && (
                          <p className="text-[10px] text-muted-foreground">
                            {usage.requests} req · {formatMAD(usage.costCents)}
                          </p>
                        )}
                        {provider.monthly_budget_cents > 0 && (
                          <p className="text-[10px] text-muted-foreground">Budget: {budgetPct}%</p>
                        )}
                      </div>
                    </div>

                    {/* Status icon */}
                    <ProviderStatusIcon
                      isActive={provider.is_active}
                      hasApiKey={provider.has_api_key}
                      isRateLimited={isRateLimited}
                    />
                  </div>

                  {/* Fallback arrow */}
                  {idx < sortedProviders.length - 1 && (
                    <div className="flex items-center gap-2 px-8 py-0.5">
                      <div className="h-px flex-1 border-t border-dashed border-muted-foreground/30" />
                      <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                      <p className="text-[9px] text-muted-foreground/50 uppercase">fallback</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Feature toggle health */}
      {data.toggles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">État des Fonctionnalités IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {data.toggles.map((toggle) => (
                <div
                  key={toggle.feature_key}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    toggle.is_enabled
                      ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
                      : "border-muted bg-muted/30"
                  }`}
                >
                  {toggle.is_enabled ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs truncate">{toggle.display_name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ModelRoutingPage() {
  return (
    <Suspense fallback={<PageLoader message="Chargement du routage IA..." />}>
      <ModelRoutingContent />
    </Suspense>
  );
}
