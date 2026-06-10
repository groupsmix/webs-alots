/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import {
  Bot,
  Check,
  Eye,
  EyeOff,
  Key,
  Loader2,
  RefreshCw,
  Shield,
  Zap,
  AlertTriangle,
  DollarSign,
  Activity,
  Settings,
  Power,
  PowerOff,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { logger } from "@/lib/logger";
import { EmergencyStop } from "./emergency-stop";
import { TaskRouting } from "./task-routing";

// ── Types ──

interface ProviderRow {
  id: string;
  provider: string;
  display_name: string;
  is_active: boolean;
  has_api_key: boolean;
  routing_tier: number;
  monthly_budget_cents: number;
  requests_this_month: number;
  tokens_this_month: number;
  last_error: string | null;
  last_used_at: string | null;
}

interface FeatureToggle {
  id: string;
  feature_key: string;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
  min_tier: number;
}

interface UsageByProvider {
  [provider: string]: {
    requests: number;
    tokens: number;
    costCents: number;
    errors: number;
  };
}

// ── Provider metadata ──

const PROVIDER_INFO: Record<
  string,
  { icon: string; color: string; docsUrl: string; keyPlaceholder: string }
> = {
  workers_ai: {
    icon: "⚡",
    color: "text-orange-500 dark:text-orange-400",
    docsUrl: "https://developers.cloudflare.com/workers-ai/",
    keyPlaceholder: "Uses your Cloudflare account (no key needed)",
  },
  anthropic: {
    icon: "🧠",
    color: "text-purple-500 dark:text-purple-400",
    docsUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-...",
  },
  openai: {
    icon: "🤖",
    color: "text-green-500 dark:text-green-400",
    docsUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
  },
  google: {
    icon: "🔮",
    color: "text-blue-500 dark:text-blue-400",
    docsUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AIza...",
  },
  xai: {
    icon: "✖",
    color: "text-gray-400 dark:text-gray-300",
    docsUrl: "https://console.x.ai/",
    keyPlaceholder: "xai-...",
  },
  mistral: {
    icon: "🌊",
    color: "text-cyan-500 dark:text-cyan-400",
    docsUrl: "https://console.mistral.ai/api-keys/",
    keyPlaceholder: "...",
  },
  deepseek: {
    icon: "🔬",
    color: "text-indigo-500 dark:text-indigo-400",
    docsUrl: "https://platform.deepseek.com/api_keys",
    keyPlaceholder: "sk-...",
  },
  groq: {
    icon: "⚡",
    color: "text-yellow-500 dark:text-yellow-400",
    docsUrl: "https://console.groq.com/keys",
    keyPlaceholder: "gsk_...",
  },
};

const PRIORITY_ORDER = [
  "anthropic",
  "openai",
  "google",
  "xai",
  "mistral",
  "deepseek",
  "groq",
  "workers_ai",
];

const TIER_LABELS: Record<number, string> = {
  0: "Free",
  1: "Budget",
  2: "Standard",
  3: "Premium",
};

// ── Page ──

export default function AISettingsPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [toggles, setToggles] = useState<FeatureToggle[]>([]);
  const [usage, setUsage] = useState<UsageByProvider>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<Record<string, "success" | "error" | null>>({});
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-config");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = (await res.json()) as {
        ok: boolean;
        data: { providers: ProviderRow[]; toggles: FeatureToggle[]; usage: UsageByProvider };
      };
      if (json.ok) {
        setProviders(json.data.providers);
        setToggles(json.data.toggles);
        setUsage(json.data.usage);
      }
    } catch (err) {
      logger.error("Failed to load AI config", { context: "ai-settings", error: err });
      addToast("Failed to load AI configuration", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedProviders = [...providers].sort((a, b) => {
    const ai = PRIORITY_ORDER.indexOf(a.provider);
    const bi = PRIORITY_ORDER.indexOf(b.provider);
    return ai - bi;
  });

  // ── Save API key ──

  const saveApiKey = async (provider: string) => {
    const key = apiKeys[provider];
    if (!key && provider !== "workers_ai") return;

    setSaving(provider);
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, api_key: key || null }),
      });
      const json = (await res.json()) as { ok: boolean };
      if (json.ok) {
        addToast(`API key saved for ${provider}`, "success");
        setApiKeys((prev) => ({ ...prev, [provider]: "" }));
        await fetchData();
      } else {
        addToast("Failed to save API key", "error");
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setSaving(null);
    }
  };

  // ── Toggle provider active state ──

  const toggleProvider = async (provider: string, active: boolean) => {
    setSaving(provider);
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, is_active: active }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; code?: string };
      if (json.ok) {
        addToast(`${provider} ${active ? "activated" : "deactivated"}`, "success");
        await fetchData();
      } else {
        if (json.code === "NO_API_KEY") {
          addToast("Add an API key first before activating", "error");
        } else {
          addToast(json.error ?? "Failed to update", "error");
        }
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setSaving(null);
    }
  };

  // ── Update budget ──

  const updateBudget = async (provider: string, budgetDollars: number) => {
    setSaving(provider);
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, monthly_budget_cents: Math.round(budgetDollars * 100) }),
      });
      const json = (await res.json()) as { ok: boolean };
      if (json.ok) {
        addToast("Budget updated", "success");
        await fetchData();
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setSaving(null);
    }
  };

  // ── Toggle feature ──

  const toggleFeature = async (featureKey: string, enabled: boolean) => {
    setSaving(featureKey);
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature_key: featureKey, is_enabled: enabled }),
      });
      const json = (await res.json()) as { ok: boolean };
      if (json.ok) {
        addToast(`Feature ${enabled ? "enabled" : "disabled"}`, "success");
        await fetchData();
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setSaving(null);
    }
  };

  // ── Test AI connection ──

  const testConnection = async (provider: string) => {
    setTestResult((prev) => ({ ...prev, [provider]: null }));
    setSaving(`test-${provider}`);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "classify",
          complexity: "simple",
          prompt: "Reply with exactly: OK",
          max_tokens: 10,
          force_provider: provider,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { text: string; provider: string; latency_ms: number };
      };
      if (json.ok && json.data) {
        setTestResult((prev) => ({ ...prev, [provider]: "success" }));
        addToast(`${provider} responded in ${json.data.latency_ms}ms`, "success");
      } else {
        setTestResult((prev) => ({ ...prev, [provider]: "error" }));
        addToast(`${provider} test failed`, "error");
      }
    } catch {
      setTestResult((prev) => ({ ...prev, [provider]: "error" }));
      addToast("Connection test failed", "error");
    } finally {
      setSaving(null);
    }
  };

  // ── Usage totals ──

  const totalRequests = Object.values(usage).reduce((s, u) => s + u.requests, 0);
  const totalCost = Object.values(usage).reduce((s, u) => s + u.costCents, 0) / 100;
  const activeCount = providers.filter((p) => p.is_active).length;

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Settings" },
          { label: "AI Configuration" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Configuration</h1>
          <p className="text-muted-foreground">
            Manage AI providers, API keys, budgets, and feature toggles
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* ── Emergency Kill Switch ── */}
      <EmergencyStop />

      {/* ── Summary Cards ── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Providers</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Activity className="h-5 w-5 text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Requests (This Month)</p>
                <p className="text-2xl font-bold">{totalRequests.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <DollarSign className="h-5 w-5 text-green-500 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cost (This Month)</p>
                <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/10 p-2">
                <Shield className="h-5 w-5 text-orange-500 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Routing</p>
                <p className="text-2xl font-bold">Best → Free</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Routing Explanation ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Zap className="mt-0.5 h-5 w-5 text-yellow-500 dark:text-yellow-400" />
            <div className="text-sm">
              <p className="font-medium">Smart Routing &amp; Fallback</p>
              <p className="text-muted-foreground">
                Requests are routed to the best active provider first (Claude → OpenAI → Gemini →
                ...). If a provider is rate-limited, over budget, or returns an error, the request
                automatically falls back to the next available provider. Workers AI is always the
                last resort — free and always available. Providers without an API key are
                automatically disabled.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Provider Cards ── */}
      <div>
        <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
          <Key className="h-5 w-5" />
          AI Providers
          <span className="text-sm font-normal text-muted-foreground">
            (priority order: best first)
          </span>
        </h2>

        <div className="space-y-3">
          {sortedProviders.map((prov, idx) => {
            const info = PROVIDER_INFO[prov.provider] ?? {
              icon: "🤖",
              color: "text-gray-500",
              docsUrl: "#",
              keyPlaceholder: "...",
            };
            const provUsage = usage[prov.provider];
            const isWorkersAI = prov.provider === "workers_ai";
            const isSaving = saving === prov.provider || saving === `test-${prov.provider}`;
            const test = testResult[prov.provider];

            return (
              <Card key={prov.id} className={prov.is_active ? "border-primary/30" : "opacity-75"}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* Left: provider info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl">{info.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{prov.display_name}</span>
                          <Badge variant={prov.is_active ? "default" : "secondary"}>
                            {prov.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline">
                            {TIER_LABELS[prov.routing_tier] ?? `Tier ${prov.routing_tier}`}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Priority #{idx + 1}
                          </Badge>
                          {test === "success" && (
                            <Badge className="bg-green-600">
                              <Check className="mr-1 h-3 w-3" /> Connected
                            </Badge>
                          )}
                          {test === "error" && (
                            <Badge variant="destructive">
                              <AlertTriangle className="mr-1 h-3 w-3" /> Failed
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {prov.has_api_key || isWorkersAI ? (
                            <span className="text-green-600 dark:text-green-400">
                              Key configured
                            </span>
                          ) : (
                            <span className="text-yellow-600 dark:text-yellow-400">No API key</span>
                          )}
                          {provUsage && (
                            <>
                              <span>•</span>
                              <span>{provUsage.requests} requests</span>
                              <span>•</span>
                              <span>${(provUsage.costCents / 100).toFixed(2)} spent</span>
                            </>
                          )}
                          {prov.last_error && (
                            <>
                              <span>•</span>
                              <span className="text-red-500 dark:text-red-400 truncate max-w-[200px]">
                                {prov.last_error}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: controls */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!isWorkersAI && (
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Input
                              type={showKeys[prov.provider] ? "text" : "password"}
                              placeholder={info.keyPlaceholder}
                              value={apiKeys[prov.provider] ?? ""}
                              onChange={(e) =>
                                setApiKeys((prev) => ({ ...prev, [prov.provider]: e.target.value }))
                              }
                              className="w-56 pr-8 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowKeys((prev) => ({
                                  ...prev,
                                  [prov.provider]: !prev[prov.provider],
                                }))
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showKeys[prov.provider] ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => saveApiKey(prov.provider)}
                            disabled={!apiKeys[prov.provider] || isSaving}
                          >
                            {isSaving && saving === prov.provider ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                        </div>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testConnection(prov.provider)}
                        disabled={(!prov.is_active && !isWorkersAI) || isSaving}
                      >
                        {saving === `test-${prov.provider}` ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Zap className="mr-1 h-3.5 w-3.5" />
                        )}
                        Test
                      </Button>

                      {!isWorkersAI && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={prov.is_active}
                            onCheckedChange={(checked) => toggleProvider(prov.provider, checked)}
                            disabled={isSaving}
                          />
                          {prov.is_active ? (
                            <Power className="h-4 w-4 text-green-500 dark:text-green-400" />
                          ) : (
                            <PowerOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      )}

                      <a
                        href={info.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Get Key
                      </a>
                    </div>
                  </div>

                  {/* Budget bar */}
                  {!isWorkersAI && prov.is_active && (
                    <div className="mt-3 flex items-center gap-3">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">
                        Monthly Budget:
                      </Label>
                      <div className="flex items-center gap-1">
                        <span className="text-xs">$</span>
                        <Input
                          type="number"
                          className="w-20 h-7 text-xs"
                          defaultValue={(prov.monthly_budget_cents / 100).toFixed(0)}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val >= 0) updateBudget(prov.provider, val);
                          }}
                          min={0}
                        />
                      </div>
                      {provUsage && prov.monthly_budget_cents > 0 && (
                        <div className="flex-1 max-w-xs">
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                provUsage.costCents / prov.monthly_budget_cents > 0.8
                                  ? "bg-red-500"
                                  : provUsage.costCents / prov.monthly_budget_cents > 0.5
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              }`}
                              style={{
                                width: `${Math.min(100, (provUsage.costCents / prov.monthly_budget_cents) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ${(provUsage.costCents / 100).toFixed(2)} / $
                            {(prov.monthly_budget_cents / 100).toFixed(0)} used
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Per-Task Model Routing ── */}
      <TaskRouting />

      {/* ── Feature Toggles ── */}
      <div>
        <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
          <Settings className="h-5 w-5" />
          AI Features
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {toggles.map((toggle) => {
            const isSavingToggle = saving === toggle.feature_key;
            return (
              <Card key={toggle.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{toggle.display_name}</p>
                      {toggle.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{toggle.description}</p>
                      )}
                      <Badge variant="outline" className="mt-1 text-xs">
                        Requires {TIER_LABELS[toggle.min_tier] ?? `Tier ${toggle.min_tier}`}{" "}
                        provider
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSavingToggle && <Loader2 className="h-4 w-4 animate-spin" />}
                      <Switch
                        checked={toggle.is_enabled}
                        onCheckedChange={(checked) => toggleFeature(toggle.feature_key, checked)}
                        disabled={isSavingToggle}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Usage Table ── */}
      {Object.keys(usage).length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Usage This Month
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Provider</th>
                      <th className="px-4 py-3 text-right font-medium">Requests</th>
                      <th className="px-4 py-3 text-right font-medium">Tokens</th>
                      <th className="px-4 py-3 text-right font-medium">Cost</th>
                      <th className="px-4 py-3 text-right font-medium">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(usage)
                      .sort(([, a], [, b]) => b.costCents - a.costCents)
                      .map(([provider, data]) => (
                        <tr key={provider} className="border-b last:border-0">
                          <td className="px-4 py-3 font-medium">
                            {PROVIDER_INFO[provider]?.icon ?? "🤖"} {provider}
                          </td>
                          <td className="px-4 py-3 text-right">{data.requests.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">{data.tokens.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            ${(data.costCents / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {data.errors > 0 ? (
                              <span className="text-red-500 dark:text-red-400">{data.errors}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
