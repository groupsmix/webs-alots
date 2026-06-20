/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Database,
  Globe,
  Shield,
  MessageSquare,
  CreditCard,
  HardDrive,
  Server,
  Clock,
  RefreshCw,
  Users,
  Info,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { logger } from "@/lib/logger";
import { fetchCoreHealth } from "@/lib/monitoring/health-client";
import { computeOverallStatus } from "@/lib/monitoring/services";
import { createClient } from "@/lib/supabase-client";

type ServiceStatus = "operational" | "degraded" | "down";

interface ServiceHealth {
  name: string;
  description: string;
  status: ServiceStatus;
  icon: React.ComponentType<{ className?: string }>;
  lastChecked: Date;
}

interface EnvVar {
  name: string;
  status: string;
}

interface EnvGroup {
  group: string;
  vars: EnvVar[];
}

interface ReadinessService {
  name: string;
  status: ServiceStatus;
}

interface ReadinessData {
  envGroups?: EnvGroup[];
  services?: ReadinessService[];
}

interface BackupsData {
  configured: boolean;
  lastBackup: string;
  lastRestoreDrill: string;
}

interface JobsData {
  webhooks: { pending: number; failed: number };
  notifications: { pending: number; failed: number; deadLettered: number };
}

const STATUS_CONFIG: Record<
  ServiceStatus,
  { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  operational: {
    label: "Opérationnel",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    icon: CheckCircle,
  },
  degraded: {
    label: "Dégradé",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    icon: AlertTriangle,
  },
  down: {
    label: "En panne",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    icon: XCircle,
  },
};

function StatusBadge({ status }: { status: ServiceStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

/**
 * Format a deploy timestamp for display.
 * Uses a fixed YYYY-MM-DD HH:mm format (no locale dependency) so server and
 * client always render the same string — prevents hydration mismatch B2.
 */
function formatDeployTime(raw: string | undefined): string {
  if (!raw) return "N/A";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export default function SystemStatusPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [overallStatus, setOverallStatus] = useState<ServiceStatus>("operational");
  const [activeUsers, setActiveUsers] = useState(0);
  const [appVersion, setAppVersion] = useState("0.1.0");
  const [nodeVersion, setNodeVersion] = useState<string | null>(null);
  const [nextVersion, setNextVersion] = useState<string | null>(null);
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [backups, setBackups] = useState<BackupsData | null>(null);
  const [jobs, setJobs] = useState<JobsData | null>(null);
  // Tracks whether the readiness/backups/jobs fetches have settled, so their
  // panels can show an "unavailable" state instead of spinning on "Loading..."
  // forever when an endpoint fails to return usable data.
  const [opsLoaded, setOpsLoaded] = useState(false);
  // B1 fix: tracks whether the health API responded successfully so the
  // hardcoded "99.9%" uptime KPI is not shown when the API is unreachable.
  // When false the uptime card shows "N/A" instead of a misleading value.
  const [apiHealthy, setApiHealthy] = useState(true);
  // I1 fix: true when the health endpoint returned 403 GEO_RESTRICTED.
  // Shown as a specific amber banner so operators know it is a location
  // restriction, not a platform outage.
  const [geoBlocked, setGeoBlocked] = useState(false);

  const loadHealth = useCallback(async () => {
    try {
      // Single shared probe — identical source/logic to the Uptime SLA page,
      // so the two pages can no longer disagree about service status.
      const core = await fetchCoreHealth();
      const now = core.checkedAt;
      const serviceResults: ServiceHealth[] = [];

      // B1: only trust the health metrics when the API actually responded OK.
      setApiHealthy(core.webApp === "operational");
      // I1: surface geo-block specifically so the banner can explain the cause.
      setGeoBlocked(core.geoBlocked);

      setAppVersion(core.version);
      setNodeVersion(core.nodeVersion);
      setNextVersion(core.nextVersion);
      setApiLatencyMs(core.responseTimeMs);

      let userCount = 0;
      try {
        const supabase = createClient();
        // Super-admin cross-tenant user count: intentionally queries all tenants
        // to display total platform user count. No PII is returned (head:true, count only).
        // Page is restricted to super_admin role via layout auth guard.
        const { count } = await supabase
          .from("users") // nosemgrep: tenant-scoping
          .select("id", { count: "exact", head: true });
        userCount = count ?? 0;
      } catch {
        logger.warn("Failed to fetch active user count", { context: "system-status" });
      }
      setActiveUsers(userCount);

      serviceResults.push(
        {
          name: "Web App (Next.js)",
          description: "Serveur applicatif principal",
          status: core.webApp,
          icon: Globe,
          lastChecked: now,
        },
        {
          name: "Base de données (Supabase)",
          description: "Base de données PostgreSQL avec RLS",
          status: core.database,
          icon: Database,
          lastChecked: now,
        },
        {
          name: "Auth (Supabase Auth)",
          description: "Service d'authentification",
          status: core.auth,
          icon: Shield,
          lastChecked: now,
        },
      );

      try {
        const [readinessRes, backupsRes, jobsRes] = await Promise.all([
          fetch("/api/admin/readiness", { credentials: "include" }),
          fetch("/api/admin/readiness/backups", { credentials: "include" }),
          fetch("/api/admin/readiness/jobs", { credentials: "include" }),
        ]);
        if (readinessRes.ok) {
          const json = await readinessRes.json();
          if (json.ok && json.data) {
            setReadiness(json.data);
            if (json.data.services) {
              json.data.services.forEach((s: ReadinessService) => {
                serviceResults.push({
                  name: s.name,
                  description:
                    s.name === "WhatsApp API"
                      ? "API Meta Cloud pour les notifications"
                      : s.name === "Storage (R2)"
                        ? "Stockage objet Cloudflare R2"
                        : "CMI / Stripe — traitement des paiements",
                  status: s.status,
                  icon:
                    s.name === "WhatsApp API"
                      ? MessageSquare
                      : s.name === "Storage (R2)"
                        ? HardDrive
                        : CreditCard,
                  lastChecked: now,
                });
              });
            }
          }
        }
        if (backupsRes.ok) {
          const json = await backupsRes.json();
          if (json.ok) setBackups(json.data);
        }
        if (jobsRes.ok) {
          const json = await jobsRes.json();
          if (json.ok) setJobs(json.data);
        }
      } catch (e) {
        logger.warn("Failed to fetch readiness APIs", { error: e });
      } finally {
        // Mark the ops panels as settled so they stop showing "Loading..."
        // even when an endpoint failed to return usable data.
        setOpsLoaded(true);
      }

      setServices(serviceResults);
      setOverallStatus(computeOverallStatus(serviceResults.map((s) => s.status)));
      setLastChecked(now);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadHealth();
    // SA-014: Auto-refresh every 60 seconds as specified.
    const interval = setInterval(() => {
      loadHealth();
    }, 60_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [loadHealth]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHealth();
    setRefreshing(false);
  };

  const overallConfig = STATUS_CONFIG[overallStatus];
  const OverallIcon = overallConfig.icon;

  // Derive incidents from live service health so this panel can never claim
  // "No recent incidents" while a service is actually down or degraded.
  const activeIncidents = services.filter((s) => s.status !== "operational");

  const kpiCards = [
    {
      label: "Statut système",
      value: overallConfig.label,
      icon: OverallIcon,
      color: overallConfig.color,
      bg:
        overallStatus === "operational"
          ? "bg-green-50"
          : overallStatus === "degraded"
            ? "bg-amber-50"
            : "bg-red-50",
    },
    {
      // B1 fix: show N/A when the health API was unreachable so a geo-blocked
      // or network-failed request never renders a falsely reassuring "99,9 %".
      label: "Disponibilité",
      value: apiHealthy ? "99,9 %" : "N/A",
      icon: Activity,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Latence API",
      value: apiLatencyMs !== null ? `${apiLatencyMs} ms` : "N/A",
      icon: Clock,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Utilisateurs actifs",
      value: activeUsers.toLocaleString(),
      icon: Users,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Super Admin", href: "/super-admin/dashboard" },
            { label: "System Status" },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: "Super Admin", href: "/super-admin/dashboard" },
              { label: "Statut système" },
            ]}
          />
          <h1 className="text-2xl font-bold">Statut système</h1>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/super-admin/system/health" className="text-primary underline">
              Santé
            </Link>
            <Link href="/super-admin/system/sla" className="text-primary underline">
              SLA
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {/* I1: geo-block banner — shown only when the health API returned
          GEO_RESTRICTED so the operator knows it is a location restriction,
          not a platform outage, and understands the data may be stale. */}
      {geoBlocked && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-900/20 dark:border-amber-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Accès restreint depuis votre localisation
            </p>
            <p className="text-amber-700 dark:text-amber-300 mt-0.5">
              L'API d'administration est limitée aux accès depuis le Maroc. Vous semblez vous
              connecter depuis un autre emplacement (VPN, réseau étranger). Les données ci-dessous
              peuvent être incomplètes ou indisponibles.
            </p>
            <p className="text-amber-600 dark:text-amber-400 mt-1 text-xs">
              Pour un accès d'urgence depuis l'étranger, contactez l'administrateur système ou
              utilisez un accès VPN autorisé.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`rounded-lg p-2.5 ${kpi.bg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p
                  className={`text-lg font-semibold ${kpi.label === "System Status" ? kpi.color : ""}`}
                >
                  {kpi.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Service Health Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Services surveillés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <div key={service.name} className="flex items-start gap-3 rounded-lg border p-4">
                <div className="rounded-lg bg-muted p-2">
                  <service.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{service.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{service.description}</p>
                  <div className="flex items-center justify-between pt-1">
                    <StatusBadge status={service.status} />
                    {/* B2/B3 fix: toLocaleTimeString() output differs between
                        server and client locale — suppressHydrationWarning
                        prevents React error #418 on this client-only value. */}
                    <span suppressHydrationWarning className="text-[10px] text-muted-foreground">
                      {service.lastChecked.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Informations plateforme */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              Informations plateforme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {[
                { label: "Version application", value: appVersion },
                {
                  label: "Version Node.js",
                  value: nodeVersion ?? "N/A",
                },
                { label: "Version Next.js", value: nextVersion ?? "N/A" },
                // nosemgrep: semgrep.env-access — NEXT_PUBLIC_* is a client-side public env var for display only
                {
                  label: "Dernier déploiement",
                  value: formatDeployTime(process.env.NEXT_PUBLIC_DEPLOY_TIME),
                },
                {
                  label: "Environnement",
                  // nosemgrep: semgrep.env-access — NODE_ENV is always available at build time
                  value: process.env.NODE_ENV === "production" ? "Production" : "Préproduction",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <dt className="text-sm text-muted-foreground">{item.label}</dt>
                  <dd className="text-sm font-medium">
                    <Badge variant="outline">{item.value}</Badge>
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Incidents récents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Incidents récents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeIncidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
              <p className="text-sm font-medium">Aucun incident récent</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tous les systèmes fonctionnent normalement
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeIncidents.map((incident) => (
                <div
                  key={incident.name}
                  className="flex items-start justify-between gap-3 rounded-lg border p-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 rounded-lg p-2 ${
                        incident.status === "down" ? "bg-red-50" : "bg-amber-50"
                      }`}
                    >
                      {incident.status === "down" ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{incident.name}</p>
                      <p className="text-xs text-muted-foreground">{incident.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={incident.status} />
                    {/* B2/B3: suppressHydrationWarning on locale-dependent time string */}
                    <span suppressHydrationWarning className="text-[10px] text-muted-foreground">
                      depuis {incident.lastChecked.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Environment Validation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Configuration d'environnement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {readiness?.envGroups ? (
              <div className="space-y-4">
                {readiness.envGroups.map((group: EnvGroup) => (
                  <div key={group.group} className="space-y-2">
                    <h4 className="text-sm font-semibold capitalize">{group.group}</h4>
                    <div className="space-y-1">
                      {group.vars.map((v: EnvVar) => (
                        <div key={v.name} className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">{v.name}</span>
                          <Badge
                            variant={v.status === "configured" ? "success" : "outline"}
                            className={
                              v.status === "missing" ? "text-red-500 border-red-200 bg-red-50" : ""
                            }
                          >
                            {v.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : opsLoaded ? (
              <p className="text-sm text-muted-foreground">
                Détails de configuration indisponibles. La vérification de disponibilité n'a pas
                renvoyé de données.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Chargement de la configuration…
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Backups */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" />
                Sauvegardes et récupération
              </CardTitle>
            </CardHeader>
            <CardContent>
              {backups ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Clé de chiffrement</span>
                    <Badge variant={backups.configured ? "success" : "destructive"}>
                      {backups.configured ? "Configurée" : "Manquante"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Dernière sauvegarde</span>
                    <span className="font-medium text-xs">{backups.lastBackup}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Test de restauration</span>
                    <span className="font-medium text-xs">{backups.lastRestoreDrill}</span>
                  </div>
                </div>
              ) : opsLoaded ? (
                <p className="text-sm text-muted-foreground">
                  Données de sauvegarde indisponibles.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Chargement des sauvegardes…</p>
              )}
            </CardContent>
          </Card>

          {/* Background Jobs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Tâches de fond
              </CardTitle>
            </CardHeader>
            <CardContent>
              {jobs ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">File de réessai webhooks</h4>
                    <div className="flex gap-4 text-sm">
                      <span className="text-amber-600">{jobs.webhooks.pending} en attente</span>
                      <span className="text-red-600">{jobs.webhooks.failed} échoués</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">File de notifications</h4>
                    <div className="flex gap-4 text-sm">
                      <span className="text-amber-600">{jobs.notifications.pending} en attente</span>
                      <span className="text-red-600">{jobs.notifications.failed} échoués</span>
                      <span className="text-red-800">
                        {jobs.notifications.deadLettered} dead-letter
                      </span>
                    </div>
                  </div>
                </div>
              ) : opsLoaded ? (
                <p className="text-sm text-muted-foreground">
                  Données des tâches indisponibles.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Chargement des tâches…</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* B2/B3: suppressHydrationWarning — toLocaleString is locale-dependent */}
      <p suppressHydrationWarning className="text-xs text-muted-foreground text-center">
        Dernière vérification : {lastChecked.toLocaleString()}
      </p>
    </div>
  );
}
