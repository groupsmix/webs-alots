/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

/**
 * Admin AI Provider Configuration — Track 3
 *
 * Allows clinic admins to view and configure which AI providers are active,
 * set monthly budgets, adjust routing tiers, and toggle AI features.
 *
 * Note: API keys are managed by super_admin only. This page shows budget/routing
 * controls that clinic_admin can influence within their subscription plan.
 */

import {
  Brain,
  Zap,
  DollarSign,
  TrendingUp,
  ToggleLeft,
  ToggleRight,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Trash2,
  Database,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { AITracesPanel } from "@/components/admin/ai-traces-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";

interface ProviderConfig {
  id: string;
  provider: string;
  display_name: string;
  has_api_key: boolean;
  is_active: boolean;
  routing_tier: 0 | 1 | 2 | 3;
  monthly_budget_cents: number;
  cost_this_month_cents: number;
  requests_this_month: number;
  rate_limited_until: string | null;
  last_error: string | null;
}

interface FeatureToggle {
  id: string;
  feature_key: string;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
  min_tier: number;
}

interface UsageStat {
  requests: number;
  tokens: number;
  costCents: number;
  errors: number;
}

interface AIConfigData {
  providers: ProviderConfig[];
  toggles: FeatureToggle[];
  usage: Record<string, UsageStat>;
}

interface AIMemoryRow {
  id: string;
  clinic_id: string;
  agent_type: string;
  content: string;
  confidence: number;
  last_used_at: string;
  created_at: string;
}

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Gratuit", color: "text-gray-500" },
  1: { label: "Économique", color: "text-blue-500" },
  2: { label: "Standard", color: "text-violet-500" },
  3: { label: "Premium", color: "text-amber-500" },
};

const PROVIDER_ICONS: Record<string, string> = {
  openai: "🤖",
  anthropic: "🧠",
  google: "✨",
  groq: "⚡",
  mistral: "🌊",
  deepseek: "🔍",
  xai: "🚀",
  workers_ai: "☁️",
};

function formatCentsToDirhams(cents: number): string {
  const dhs = cents / 100;
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 2,
  }).format(dhs);
}

function BudgetBar({ used, budget }: { used: number; budget: number }) {
  if (budget === 0) return <p className="text-xs text-muted-foreground">Illimité</p>;
  const pct = Math.min(100, Math.round((used / budget) * 100));
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatCentsToDirhams(used)} utilisés</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">Budget: {formatCentsToDirhams(budget)}/mois</p>
    </div>
  );
}

export default function AIConfigAdminPage() {
  const [data, setData] = useState<AIConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null);
  const [memories, setMemories] = useState<AIMemoryRow[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [deletingMemory, setDeletingMemory] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai-config", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Échec du chargement");
      }
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMemories = useCallback(async () => {
    setMemoriesLoading(true);
    try {
      const res = await fetch("/api/admin/ai-memories", { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setMemories(json.data?.memories ?? []);
      }
    } catch {
      // Non-critical — memories section is supplementary
    } finally {
      setMemoriesLoading(false);
    }
  }, []);

  const handleDeleteMemory = async (id: string) => {
    setDeletingMemory(id);
    try {
      const res = await fetch("/api/admin/ai-memories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
      }
    } catch {
      // Ignore
    } finally {
      setDeletingMemory(null);
    }
  };

  useEffect(() => {
    loadConfig();
    loadMemories();
  }, [loadConfig, loadMemories]);

  const handleToggleFeature = async (featureKey: string, currentEnabled: boolean) => {
    setTogglingFeature(featureKey);
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ feature_key: featureKey, is_enabled: !currentEnabled }),
      });
      if (!res.ok) throw new Error("Échec de la mise à jour");
      await loadConfig();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur lors de la mise à jour");
    } finally {
      setTogglingFeature(null);
    }
  };

  if (loading) return <PageLoader message="Chargement de la configuration IA..." />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={loadConfig}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const activeProviders = data.providers.filter((p) => p.is_active);
  const totalCostThisMonth = data.providers.reduce((s, p) => s + p.cost_this_month_cents, 0);
  const totalRequests = data.providers.reduce((s, p) => s + p.requests_this_month, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-violet-600" />
            Configuration IA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gérez les fournisseurs IA, budgets et fonctionnalités pour votre clinique
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadConfig}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Fournisseurs actifs",
            value: `${activeProviders.length} / ${data.providers.length}`,
            icon: Zap,
            color: "text-green-600",
          },
          {
            label: "Coût ce mois",
            value: formatCentsToDirhams(totalCostThisMonth),
            icon: DollarSign,
            color: "text-blue-600",
          },
          {
            label: "Requêtes ce mois",
            value: totalRequests.toLocaleString("fr-MA"),
            icon: TrendingUp,
            color: "text-violet-600",
          },
          {
            label: "Fonctionnalités actives",
            value: `${data.toggles.filter((t) => t.is_enabled).length} / ${data.toggles.length}`,
            icon: Brain,
            color: "text-amber-600",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`rounded-lg p-2 bg-muted ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold text-sm">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Providers */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Fournisseurs IA</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {data.providers.map((provider) => {
            const usage = data.usage[provider.provider];
            const tierInfo = TIER_LABELS[provider.routing_tier] ?? TIER_LABELS[0];
            const isRateLimited =
              provider.rate_limited_until && new Date(provider.rate_limited_until) > new Date();

            return (
              <Card
                key={provider.provider}
                className={`transition-all ${
                  provider.is_active ? "border-primary/20" : "opacity-60 border-muted"
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{PROVIDER_ICONS[provider.provider] ?? "🤖"}</span>
                      <div>
                        <CardTitle className="text-base">{provider.display_name}</CardTitle>
                        <p className={`text-xs font-medium ${tierInfo.color}`}>
                          Tier {provider.routing_tier} — {tierInfo.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isRateLimited && (
                        <Badge variant="destructive" className="text-[10px]">
                          Limité
                        </Badge>
                      )}
                      {provider.is_active ? (
                        <Badge className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Actif
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          <XCircle className="h-3 w-3 mr-1 text-muted-foreground" />
                          Inactif
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* API Key status */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Clé API</span>
                    <span className={provider.has_api_key ? "text-green-600" : "text-red-500"}>
                      {provider.has_api_key ? "✓ Configurée" : "✗ Manquante"}
                    </span>
                  </div>

                  {/* Usage this month */}
                  {usage && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: "Requêtes", value: usage.requests.toLocaleString("fr-MA") },
                        { label: "Tokens", value: (usage.tokens / 1000).toFixed(1) + "k" },
                        { label: "Erreurs", value: usage.errors.toString() },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded bg-muted/50 p-1.5">
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                          <p className="text-xs font-semibold">{value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Budget bar */}
                  <BudgetBar
                    used={provider.cost_this_month_cents}
                    budget={provider.monthly_budget_cents}
                  />

                  {/* Last error */}
                  {provider.last_error && (
                    <div className="flex items-start gap-1.5 rounded border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-red-700 dark:text-red-400 line-clamp-2">
                        {provider.last_error}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Feature Toggles */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-semibold">Fonctionnalités IA</h2>
          <div className="flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-2 py-1">
            <Info className="h-3.5 w-3.5 text-amber-600" />
            <p className="text-[10px] text-amber-700 dark:text-amber-400">
              Outil d&apos;aide clinique — ne remplace pas le jugement médical
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {data.toggles.map((toggle) => (
            <Card key={toggle.feature_key}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{toggle.display_name}</p>
                  {toggle.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {toggle.description}
                    </p>
                  )}
                  <Badge variant="outline" className="text-[10px] mt-1">
                    Tier min: {toggle.min_tier}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => handleToggleFeature(toggle.feature_key, toggle.is_enabled)}
                  disabled={togglingFeature === toggle.feature_key}
                >
                  {togglingFeature === toggle.feature_key ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : toggle.is_enabled ? (
                    <ToggleRight className="h-6 w-6 text-green-500" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── AI Memories (Phase B3) ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-violet-500" />
            <h2 className="text-lg font-semibold">Mémoire IA</h2>
            <Badge variant="outline" className="text-[10px]">
              {memories.length} entrée(s)
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={loadMemories} disabled={memoriesLoading}>
            {memoriesLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        {memories.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              Aucune mémoire enregistrée — les faits cliniques seront extraits automatiquement des
              conversations.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {memories.map((mem) => (
              <Card key={mem.id}>
                <CardContent className="p-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{mem.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {mem.agent_type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        Confiance: {Math.round(mem.confidence * 100)}%
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(mem.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteMemory(mem.id)}
                    disabled={deletingMemory === mem.id}
                  >
                    {deletingMemory === mem.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* E1: AI Traces */}
      <div className="border-t pt-6">
        <AITracesPanel />
      </div>
    </div>
  );
}
