"use client";

import {
  LogIn,
  Search,
  Ban,
  CheckCircle,
  Eye,
  Filter,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Users,
  TrendingUp,
  Loader2,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowUpDown,
  Shield,
  Send,
  Zap,
  RefreshCw,
  Check,
  Minus,
  Heart,
  Image,
  Clock,
  Briefcase,
  UserCheck,
  CalendarCheck,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import { exportToCSV } from "@/lib/export-data";
import { logger } from "@/lib/logger";
import { fetchClinics, updateClinicStatus } from "@/lib/super-admin-actions";
import { getLocalDateStr, formatCurrency, formatNumber } from "@/lib/utils";

/** Subset of the clinics.config JSONB column used in clinic management. */
interface ClinicConfigJson {
  city?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  domain?: string;
}

/** Anonymized user count range — avoids exposing exact patient numbers. */
type UserCountRange = "0" | "1-50" | "51-200" | "200+";

interface ClinicDetail {
  id: string;
  name: string;
  type: "doctor" | "dentist" | "pharmacy";
  plan: string;
  city: string;
  /** Anonymized range instead of exact count for privacy compliance. */
  userCountRange: UserCountRange;
  monthlyRevenue: number;
  status: "active" | "suspended" | "trial";
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  createdAt: string;
  doctorsCount: number;
  appointmentsThisMonth: number;
  domain?: string;
  lastLoginAt: string;
  features: Record<string, boolean>;
}

type FilterType = "all" | "doctor" | "dentist" | "pharmacy";
type FilterStatus = "all" | "active" | "suspended" | "trial";
type HealthFilter = "all" | "excellent" | "good" | "fair" | "at-risk";
type SortField = "name" | "health" | "status" | "plan";
type SortDirection = "asc" | "desc";

// --------------- Health Score ---------------

interface HealthCategory {
  label: string;
  value: number;
  max: number;
}

interface HealthBreakdown {
  categories: HealthCategory[];
  total: number;
  source: "live" | "fallback";
  trend?: string;
  topRiskSignal?: string;
  topStrengthSignal?: string;
  churnRisk?: string;
}

interface ClinicHealthScoreRow {
  clinicId: string;
  clinicName: string;
  score: number;
  grade: string;
  topRiskSignal: string;
  topStrengthSignal: string;
  trend: string;
  churnRisk: string;
  computedAt: string;
  signalsSnapshot: Record<string, unknown>;
}

interface PlatformHealthSummary {
  totalClinics: number;
  averageScore: number;
  countsByGrade: Record<string, number>;
  countsByRisk: Record<string, number>;
  improvingCount: number;
  decliningCount: number;
  topAtRisk: Array<{
    clinicId: string;
    clinicName: string;
    score: number;
    churnRisk: string;
    trend: string;
    topRiskSignal: string;
  }>;
  topPerformers: Array<{
    clinicId: string;
    clinicName: string;
    score: number;
    grade: string;
    topStrengthSignal: string;
  }>;
}

interface PlatformAlertRow {
  id: string;
  clinic_id: string | null;
  alert_type: string;
  severity: string;
  is_read: boolean;
  created_at: string;
}

interface ClinicsQueryResponse {
  template: { id: string; title: string; description: string };
  rows: Array<Record<string, unknown>>;
  availableQueries: Array<{ id: string; title: string }>;
}

function clamp20(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(20, Math.round(value)));
}

function toScore20(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return clamp20(numeric * 20);
}

function buildFallbackHealthScore(clinic: ClinicDetail): HealthBreakdown {
  const profileFields = [
    clinic.name,
    clinic.ownerPhone,
    clinic.ownerEmail,
    clinic.city,
    clinic.type,
  ];
  const filled = profileFields.filter((f) => f && f.length > 0).length;
  const profileCompleteness = Math.round((filled / profileFields.length) * 20);

  const activeSubscription = clinic.status !== "suspended" ? 20 : 0;

  const recentActivity = clinic.lastLoginAt
    ? (Date.now() - new Date(clinic.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24) <= 7
      ? 20
      : 10
    : clinic.status === "active"
      ? 15
      : 5;

  const featureKeys = Object.keys(clinic.features);
  const enabledFeatures = Object.values(clinic.features).filter(Boolean).length;
  const featureAdoption =
    featureKeys.length > 0
      ? enabledFeatures / featureKeys.length >= 0.5
        ? 20
        : Math.round((enabledFeatures / featureKeys.length) * 20)
      : clinic.plan === "premium"
        ? 18
        : clinic.plan === "standard"
          ? 14
          : 10;

  const paymentStatus = clinic.status === "suspended" ? 5 : clinic.status === "trial" ? 15 : 20;

  const categories = [
    { label: "Profile", value: profileCompleteness, max: 20 },
    { label: "Subscription", value: activeSubscription, max: 20 },
    { label: "Activity", value: recentActivity, max: 20 },
    { label: "Features", value: featureAdoption, max: 20 },
    { label: "Payment", value: paymentStatus, max: 20 },
  ];

  return {
    categories,
    total: categories.reduce((sum, item) => sum + item.value, 0),
    source: "fallback",
  };
}

function buildLiveHealthScore(health: ClinicHealthScoreRow): HealthBreakdown {
  const snapshot = health.signalsSnapshot ?? {};
  const paymentHealthy = snapshot.paymentHealthy === true ? 1 : 0;
  const negativeSupportRate =
    typeof snapshot.negativeSupportRate === "number" ? snapshot.negativeSupportRate : 0;
  const paymentSupport = clamp20(((paymentHealthy + (1 - negativeSupportRate)) / 2) * 20);

  return {
    categories: [
      { label: "Logins", value: toScore20(snapshot.loginFrequency), max: 20 },
      { label: "Bookings", value: toScore20(snapshot.appointmentBookingRate), max: 20 },
      { label: "Attendance", value: toScore20(1 - Number(snapshot.noShowRate ?? 0)), max: 20 },
      { label: "Features", value: toScore20(snapshot.featureAdoption), max: 20 },
      { label: "Pay/Support", value: paymentSupport, max: 20 },
    ],
    total: health.score,
    source: "live",
    trend: health.trend,
    topRiskSignal: health.topRiskSignal,
    topStrengthSignal: health.topStrengthSignal,
    churnRisk: health.churnRisk,
  };
}

function getHealthBreakdown(clinic: ClinicDetail, health?: ClinicHealthScoreRow): HealthBreakdown {
  return health ? buildLiveHealthScore(health) : buildFallbackHealthScore(clinic);
}

type HealthLabel = "Excellent" | "Good" | "Fair" | "At Risk";

function getHealthLabel(score: number): HealthLabel {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "At Risk";
}

function getHealthBadgeClasses(label: HealthLabel): string {
  switch (label) {
    case "Excellent":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "Good":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "Fair":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "At Risk":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }
}

function formatSignalName(signal?: string): string {
  switch (signal) {
    case "loginFrequency":
      return "Login frequency";
    case "appointmentBookingRate":
      return "Booking rate";
    case "noShowRateInverted":
    case "noShowRate":
      return "Attendance";
    case "featureAdoption":
      return "Feature adoption";
    case "paymentHealthy":
      return "Payments";
    case "negativeSupportRateInverted":
    case "negativeSupportRate":
      return "Support quality";
    default:
      return signal ? signal.replace(/_/g, " ") : "Unknown";
  }
}

function formatTrendLabel(trend?: string): string {
  switch (trend) {
    case "improving":
      return "Improving";
    case "declining":
      return "Declining";
    case "stable":
      return "Stable";
    default:
      return "Unknown";
  }
}

// --------------- Onboarding Checklist ---------------

interface ChecklistItem {
  label: string;
  done: boolean;
  icon: typeof Image;
}

function getOnboardingChecklist(clinic: ClinicDetail): ChecklistItem[] {
  const hasName = clinic.name.length > 0;
  const hasCity = clinic.city.length > 0;
  const hasEmail = clinic.ownerEmail.length > 0;

  return [
    { label: "Logo uploaded", done: hasName && hasCity, icon: Image },
    {
      label: "Business hours configured",
      done: clinic.status === "active" || clinic.status === "trial",
      icon: Clock,
    },
    {
      label: "Services added",
      done: clinic.type !== "pharmacy" ? hasEmail : hasName,
      icon: Briefcase,
    },
    { label: "Staff members added", done: clinic.doctorsCount > 0 || hasEmail, icon: UserCheck },
    {
      label: "First appointment booked",
      done: clinic.appointmentsThisMonth > 0,
      icon: CalendarCheck,
    },
    {
      label: "Payment method configured",
      done: clinic.plan === "premium" || clinic.plan === "standard",
      icon: CreditCard,
    },
  ];
}

// --------------- Health Score Tooltip (rich) ---------------

/* eslint-disable i18next/no-literal-string -- admin-only dashboard labels */
function HealthScoreTooltip({
  breakdown,
  visible,
}: {
  breakdown: HealthBreakdown;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div
      role="tooltip"
      className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
    >
      <p className="font-semibold mb-2">Health Score Breakdown</p>
      {breakdown.categories.map((r) => (
        <div key={r.label} className="flex justify-between py-0.5">
          <span className="text-muted-foreground">{r.label}</span>
          <span className="font-medium">
            {r.value}/{r.max}
          </span>
        </div>
      ))}
      <Separator className="my-1.5" />
      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span>{breakdown.total}/100</span>
      </div>
      {breakdown.source === "live" && (breakdown.trend || breakdown.churnRisk) ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          {breakdown.trend ? `Trend: ${breakdown.trend}` : ""}
          {breakdown.trend && breakdown.churnRisk ? " · " : ""}
          {breakdown.churnRisk ? `Risk: ${breakdown.churnRisk}` : ""}
        </p>
      ) : null}
    </div>
  );
}

/* eslint-enable i18next/no-literal-string */

// --------------- Bulk Action Types ---------------

type BulkAction =
  | "change-tier"
  | "send-announcement"
  | "enable-feature"
  | "suspend"
  | "export"
  | "change-status";

const TIER_OPTIONS = ["free", "standard", "premium", "enterprise"];
const FEATURE_OPTIONS = [
  "whatsapp",
  "online-booking",
  "analytics",
  "telehealth",
  "inventory",
  "billing",
];
const STATUS_OPTIONS: ("active" | "suspended")[] = ["active", "suspended"];

// --------------- Skeleton ---------------

/* eslint-disable i18next/no-literal-string -- admin-only table headers */
function ClinicsTableSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="table-mobile-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left font-medium py-3 px-4">Clinic</th>
                <th className="text-left font-medium py-3 px-4 hidden md:table-cell">Owner</th>
                <th className="text-left font-medium py-3 px-4">Type</th>
                <th className="text-left font-medium py-3 px-4 hidden lg:table-cell">City</th>
                <th className="text-left font-medium py-3 px-4">Users</th>
                <th className="text-left font-medium py-3 px-4 hidden lg:table-cell">Revenue</th>
                <th className="text-left font-medium py-3 px-4">Plan</th>
                <th className="text-left font-medium py-3 px-4">Health</th>
                <th className="text-left font-medium py-3 px-4">Status</th>
                <th className="text-right font-medium py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-3 px-4">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <div className="h-4 w-28 bg-muted animate-pulse rounded" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-5 w-14 bg-muted animate-pulse rounded-full" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-5 w-14 bg-muted animate-pulse rounded-full" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-5 w-14 bg-muted animate-pulse rounded-full" />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="h-6 w-20 bg-muted animate-pulse rounded ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
/* eslint-enable i18next/no-literal-string */

export default function AllClinicsPage() {
  const [locale] = useLocale();

  const router = useRouter();
  const { addToast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [detail, setDetail] = useState<ClinicDetail | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginClinic, setLoginClinic] = useState<ClinicDetail | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendClinic, setSuspendClinic] = useState<ClinicDetail | null>(null);
  const [list, setList] = useState<ClinicDetail[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmName, setConfirmName] = useState("");
  const [impersonateReason, setImpersonateReason] = useState("");
  const [impersonatePassword, setImpersonatePassword] = useState("");

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk action dialog state
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkActionValue, setBulkActionValue] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");

  // Health score tooltip
  const [hoveredHealthId, setHoveredHealthId] = useState<string | null>(null);
  const [healthRowsByClinicId, setHealthRowsByClinicId] = useState<
    Map<string, ClinicHealthScoreRow>
  >(new Map());
  const [platformHealthSummary, setPlatformHealthSummary] = useState<PlatformHealthSummary | null>(
    null,
  );
  const [platformAlerts, setPlatformAlerts] = useState<PlatformAlertRow[]>([]);
  const [platformNarrative, setPlatformNarrative] = useState<string | null>(null);
  const [platformNarrativeLoading, setPlatformNarrativeLoading] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [detailNarrative, setDetailNarrative] = useState<string | null>(null);
  const [detailNarrativeLoading, setDetailNarrativeLoading] = useState(false);
  const [queryInput, setQueryInput] = useState("Show top at-risk clinics");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<ClinicsQueryResponse | null>(null);

  const loadClinics = useCallback(async () => {
    try {
      const clinics = await fetchClinics();
      const mapped: ClinicDetail[] = clinics.map((c) => {
        const config = (c.config ?? {}) as ClinicConfigJson;
        return {
          id: c.id,
          name: c.name,
          type: c.type as "doctor" | "dentist" | "pharmacy",
          plan: c.tier ?? "pro",
          city: config.city ?? "",
          userCountRange: "0" as UserCountRange,
          monthlyRevenue: 0,
          status: (c.status === "inactive" ? "suspended" : (c.status ?? "active")) as
            | "active"
            | "suspended"
            | "trial",
          ownerName: config.ownerName ?? "",
          ownerEmail: config.email ?? "",
          ownerPhone: config.phone ?? "",
          createdAt: c.created_at ?? "",
          doctorsCount: 0,
          appointmentsThisMonth: 0,
          domain: config.domain ?? undefined,
          lastLoginAt: "",
          features: {},
        };
      });
      setList(mapped);
    } catch (err) {
      logger.warn("Failed to load clinics list", { context: "page", error: err });
    } finally {
      setLoadingData(false);
    }
  }, []);

  const loadHealthScores = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/clinic-health?limit=500&include_alerts=true");
      const json = (await res.json()) as {
        ok: boolean;
        data?: {
          scores?: ClinicHealthScoreRow[];
          summary?: PlatformHealthSummary;
          alerts?: PlatformAlertRow[];
        };
        error?: string;
      };

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Failed to load clinic health scores");
      }

      const next = new Map<string, ClinicHealthScoreRow>();
      for (const row of json.data?.scores ?? []) {
        next.set(row.clinicId, row);
      }
      setHealthRowsByClinicId(next);
      setPlatformHealthSummary(json.data?.summary ?? null);
      setPlatformAlerts(json.data?.alerts ?? []);
    } catch (err) {
      logger.warn("Failed to load live clinic health scores", {
        context: "clinics-page",
        error: err,
      });
      setHealthRowsByClinicId(new Map());
      setPlatformHealthSummary(null);
      setPlatformAlerts([]);
    }
  }, []);

  const loadPlatformNarrative = useCallback(async () => {
    try {
      setPlatformNarrativeLoading(true);
      const res = await fetch("/api/admin/clinic-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { narrative?: string };
        error?: string;
      };

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Failed to load platform narrative");
      }

      setPlatformNarrative(json.data?.narrative ?? null);
    } catch (err) {
      logger.warn("Failed to load platform narrative", {
        context: "clinics-page",
        error: err,
      });
      setPlatformNarrative(null);
    } finally {
      setPlatformNarrativeLoading(false);
    }
  }, []);

  const loadClinicNarrative = useCallback(async (clinicId: string) => {
    const res = await fetch("/api/admin/clinic-narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinic_id: clinicId }),
    });
    const json = (await res.json()) as {
      ok: boolean;
      data?: { narrative?: string };
      error?: string;
    };

    if (!res.ok || !json.ok) {
      throw new Error(json.error ?? "Failed to load clinic narrative");
    }

    return json.data?.narrative ?? null;
  }, []);

  const runApprovedQuery = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;

      try {
        setQueryLoading(true);
        const res = await fetch("/api/admin/clinics-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, limit: 8 }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: ClinicsQueryResponse;
          error?: string;
        };

        if (!res.ok || !json.ok) {
          throw new Error(json.error ?? "Failed to run approved clinics query");
        }

        setQueryResult(json.data ?? null);
      } catch (err) {
        logger.warn("Failed to run approved clinics query", {
          context: "clinics-page",
          error: err,
        });
        addToast("Failed to run clinics query", "error");
        setQueryResult(null);
      } finally {
        setQueryLoading(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadClinics();
    void loadHealthScores();
    void loadPlatformNarrative();
    return () => {
      controller.abort();
    };
  }, [loadClinics, loadHealthScores, loadPlatformNarrative]);

  useEffect(() => {
    if (!detail) {
      setDetailNarrative(null);
      setDetailNarrativeLoading(false);
      return;
    }

    let cancelled = false;
    setDetailNarrativeLoading(true);
    setDetailNarrative(null);

    void loadClinicNarrative(detail.id)
      .then((narrative) => {
        if (cancelled) return;
        setDetailNarrative(narrative);
      })
      .catch((err) => {
        if (cancelled) return;
        logger.warn("Failed to load clinic narrative", {
          context: "clinics-page",
          clinicId: detail.id,
          error: err,
        });
      })
      .finally(() => {
        if (!cancelled) setDetailNarrativeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detail, loadClinicNarrative]);

  // Precompute health scores
  const healthScores = useMemo(() => {
    const map = new Map<string, HealthBreakdown>();
    for (const c of list) {
      map.set(c.id, getHealthBreakdown(c, healthRowsByClinicId.get(c.id)));
    }
    return map;
  }, [list, healthRowsByClinicId]);

  const filtered = list.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      c.ownerName.toLowerCase().includes(q);

    const matchHealth =
      healthFilter === "all" ||
      (() => {
        const score = healthScores.get(c.id)?.total ?? 0;
        switch (healthFilter) {
          case "excellent":
            return score >= 80;
          case "good":
            return score >= 60 && score < 80;
          case "fair":
            return score >= 40 && score < 60;
          case "at-risk":
            return score < 40;
        }
      })();

    return (
      matchSearch &&
      (typeFilter === "all" || c.type === typeFilter) &&
      (statusFilter === "all" || c.status === statusFilter) &&
      matchHealth
    );
  });

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "health":
          cmp = (healthScores.get(a.id)?.total ?? 0) - (healthScores.get(b.id)?.total ?? 0);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "plan":
          cmp = a.plan.localeCompare(b.plan);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir, healthScores]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginatedList = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, statusFilter, healthFilter]);

  // Clear selection when filters/data change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, typeFilter, statusFilter, healthFilter, list]);

  // Bulk selection helpers
  const allPageSelected =
    paginatedList.length > 0 && paginatedList.every((c) => selectedIds.has(c.id));
  const somePageSelected = paginatedList.some((c) => selectedIds.has(c.id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const c of paginatedList) next.delete(c.id);
      } else {
        for (const c of paginatedList) next.add(c.id);
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedClinics = list.filter((c) => selectedIds.has(c.id));

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  // Export clinics to CSV
  function handleExportCSV() {
    exportToCSV(
      filtered,
      [
        { key: "name", label: "Nom clinique" },
        { key: "type", label: "Type" },
        { key: "ownerName", label: "Propriétaire" },
        { key: "ownerEmail", label: "Email" },
        { key: "ownerPhone", label: "Téléphone" },
        { key: "city", label: "Ville" },
        { key: "plan", label: "Plan" },
        { key: "status", label: "Statut" },
        { key: "userCountRange", label: "Utilisateurs (tranche)" },
        { key: "createdAt", label: "Créé le" },
      ],
      `clinics-export-${getLocalDateStr()}.csv`,
    );
  }

  // Export selected clinics to CSV
  function handleExportSelectedCSV() {
    const clinicsWithHealth = selectedClinics.map((c) => ({
      ...c,
      healthScore: healthScores.get(c.id)?.total ?? 0,
    }));
    exportToCSV(
      clinicsWithHealth,
      [
        { key: "name", label: "Nom clinique" },
        { key: "type", label: "Type" },
        { key: "ownerName", label: "Propriétaire" },
        { key: "ownerEmail", label: "Email" },
        { key: "ownerPhone", label: "Téléphone" },
        { key: "city", label: "Ville" },
        { key: "plan", label: "Plan" },
        { key: "status", label: "Statut" },
        { key: "healthScore", label: "Score santé" },
        { key: "userCountRange", label: "Utilisateurs (tranche)" },
        { key: "createdAt", label: "Créé le" },
      ],
      `clinics-selected-${getLocalDateStr()}.csv`,
    );
    addToast(`Exported ${selectedClinics.length} clinics to CSV`, "success");
    setSelectedIds(new Set());
  }

  // Bulk action handlers — POST to /api/super-admin/clinics/bulk, then refresh
  // from the DB so the table reflects persisted state (no more mock toasts).
  async function executeBulkAction() {
    if (!bulkAction) return;
    if (bulkAction === "export") {
      handleExportSelectedCSV();
      return;
    }

    const ids = selectedClinics.map((c) => c.id);
    const count = ids.length;
    if (count === 0) return;

    // Translate the UI action into the API contract.
    let body: { action: string; ids: string[]; message?: string; value?: string };
    switch (bulkAction) {
      case "suspend":
        body = { action: "suspend", ids };
        break;
      case "send-announcement": {
        const message = [announcementTitle.trim(), announcementBody.trim()]
          .filter(Boolean)
          .join("\n\n");
        if (!message) {
          addToast("Announcement message is required", "error");
          return;
        }
        body = { action: "announce", ids, message };
        break;
      }
      case "change-tier":
        if (!bulkActionValue) {
          addToast("Select a tier first", "error");
          return;
        }
        body = { action: "change_tier", ids, value: bulkActionValue };
        break;
      case "enable-feature":
        if (!bulkActionValue) {
          addToast("Select a feature first", "error");
          return;
        }
        body = { action: "enable_feature", ids, value: bulkActionValue };
        break;
      case "change-status":
        if (!bulkActionValue) {
          addToast("Select a status first", "error");
          return;
        }
        body = { action: "change_status", ids, value: bulkActionValue };
        break;
      default:
        return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/super-admin/clinics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Bulk request failed: ${res.status}`);
      }
      // Re-fetch so tier/status changes are reflected from the source of truth.
      await loadClinics();
      addToast(`Action applied to ${count} clinic${count === 1 ? "" : "s"}`, "success");
      setBulkAction(null);
      setBulkActionValue("");
      setAnnouncementTitle("");
      setAnnouncementBody("");
      setSelectedIds(new Set());
    } catch (err) {
      logger.warn("Bulk action failed", { context: "super-admin/clinics", error: err });
      addToast("Bulk action failed. Please try again.", "error");
    } finally {
      setActionLoading(false);
    }
  }

  function openBulkAction(action: BulkAction) {
    if (action === "export") {
      handleExportSelectedCSV();
      return;
    }
    setBulkAction(action);
    setBulkActionValue("");
    setAnnouncementTitle("");
    setAnnouncementBody("");
  }

  function getBulkDialogTitle(): string {
    switch (bulkAction) {
      case "change-tier":
        return "Change Tier";
      case "send-announcement":
        return "Send Announcement";
      case "enable-feature":
        return "Enable Feature";
      case "suspend":
        return "Suspend Clinics";
      case "change-status":
        return "Change Status";
      default:
        return "";
    }
  }

  async function toggleStatus(clinic: ClinicDetail) {
    setActionLoading(true);
    try {
      const newStatus = clinic.status === "suspended" ? "active" : "suspended";
      await updateClinicStatus(clinic.id, newStatus);
      setList((prev) =>
        prev.map((c) =>
          c.id === clinic.id ? { ...c, status: newStatus as "active" | "suspended" | "trial" } : c,
        ),
      );
      addToast(
        newStatus === "active"
          ? `${clinic.name} has been activated`
          : `${clinic.name} has been suspended`,
        "success",
      );
    } catch (err) {
      logger.warn("Failed to search clinics", { context: "page", error: err });
      addToast("Failed to update clinic status", "error");
    } finally {
      setActionLoading(false);
    }
    setSuspendOpen(false);
  }

  async function refreshHealthAnalytics() {
    try {
      setRefreshingHealth(true);
      const res = await fetch("/api/admin/clinic-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ create_alerts: true }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Failed to recompute clinic health");
      }

      await Promise.all([loadHealthScores(), loadPlatformNarrative()]);

      if (detail) {
        setDetailNarrativeLoading(true);
        try {
          const narrative = await loadClinicNarrative(detail.id);
          setDetailNarrative(narrative);
        } finally {
          setDetailNarrativeLoading(false);
        }
      }

      addToast("Données de santé cliniques actualisées", "success");
    } catch (err) {
      logger.warn("Failed to refresh clinic health analytics", {
        context: "clinics-page",
        error: err,
      });
      addToast("Failed to refresh clinic health analytics", "error");
    } finally {
      setRefreshingHealth(false);
    }
  }

  const criticalClinicCount = platformHealthSummary?.countsByRisk?.critical ?? 0;
  const highRiskClinicCount = platformHealthSummary?.countsByRisk?.high ?? 0;
  const topAtRiskClinic = platformHealthSummary?.topAtRisk?.[0] ?? null;
  const topPerformerClinic = platformHealthSummary?.topPerformers?.[0] ?? null;

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Clinics" }]}
      />
      {/* eslint-disable i18next/no-literal-string -- admin-only header and Owner AI / NL query panel labels */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">All Clinics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all {list.length} registered clinics
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={refreshHealthAnalytics}
            disabled={refreshingHealth || loadingData}
          >
            {refreshingHealth ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Refresh Health
          </Button>
          <Button variant="outline" onClick={handleExportCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Link href="/super-admin/onboarding">
            <Button>
              <UserPlus className="h-4 w-4 mr-1" />
              New Client Setup
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Clinics analyzed</p>
              <p className="mt-1 text-2xl font-bold">{platformHealthSummary?.totalClinics ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {platformHealthSummary
                  ? `${platformHealthSummary.improvingCount} improving · ${platformHealthSummary.decliningCount} declining`
                  : "Owner analytics loading"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Average health score</p>
              <p className="mt-1 text-2xl font-bold">
                {platformHealthSummary?.averageScore ?? 0}/100
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Top performer: {topPerformerClinic?.clinicName ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">At-risk clinics</p>
              <p className="mt-1 text-2xl font-bold">{criticalClinicCount + highRiskClinicCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {criticalClinicCount} critical · {highRiskClinicCount} high risk
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Unread platform alerts</p>
              <p className="mt-1 text-2xl font-bold">{platformAlerts.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Focus clinic: {topAtRiskClinic?.clinicName ?? "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">Platform Health Narrative</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aggregate-only owner summary across clinics, alerts, onboarding, and support.
                </p>
              </div>
              {topAtRiskClinic ? (
                <Badge className={getHealthBadgeClasses(getHealthLabel(topAtRiskClinic.score))}>
                  {topAtRiskClinic.clinicName}: {topAtRiskClinic.score}/100
                </Badge>
              ) : null}
            </div>

            {platformNarrativeLoading ? (
              <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading platform narrative…
              </div>
            ) : platformNarrative ? (
              <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">
                {platformNarrative}
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No platform narrative available yet.
              </p>
            )}

            <Separator className="my-4" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Priority clinic
                </h3>
                <p className="mt-1 text-sm font-medium">{topAtRiskClinic?.clinicName ?? "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {topAtRiskClinic
                    ? `${topAtRiskClinic.score}/100 · ${formatSignalName(topAtRiskClinic.topRiskSignal)}`
                    : "No elevated risk clinic detected"}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent alerts
                </h3>
                <div className="mt-1 flex flex-wrap gap-2">
                  {platformAlerts.length > 0 ? (
                    platformAlerts.slice(0, 3).map((alert) => (
                      <Badge key={alert.id} variant="outline" className="capitalize">
                        {alert.severity} · {alert.alert_type.replace(/_/g, " ")}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No unread platform alerts</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">Approved analytics query</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ask a supported owner question about risk, onboardings, alerts, or support
                  backlog.
                </p>
              </div>
              <Badge variant="outline">Owner AI</Badge>
            </div>
            <div className="mt-4 flex gap-2">
              <Input value={queryInput} onChange={(e) => setQueryInput(e.target.value)} />
              <Button onClick={() => runApprovedQuery(queryInput)} disabled={queryLoading}>
                {queryLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Show top at-risk clinics",
                "Which onboardings are stuck?",
                "Show critical platform alerts",
                "What's the support backlog?",
              ].map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setQueryInput(suggestion);
                    void runApprovedQuery(suggestion);
                  }}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">Query results</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Latest approved analytics query output.
                </p>
              </div>
              {queryResult?.template ? (
                <Badge variant="outline">{queryResult.template.title}</Badge>
              ) : null}
            </div>

            {queryLoading ? (
              <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Running query…
              </div>
            ) : queryResult ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground">{queryResult.template.description}</p>
                {queryResult.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rows returned for this query.</p>
                ) : (
                  queryResult.rows.slice(0, 4).map((row, index) => (
                    <div key={index} className="rounded-lg border p-3 text-xs">
                      {Object.entries(row)
                        .slice(0, 6)
                        .map(([key, value]) => (
                          <div key={key} className="flex justify-between gap-3 py-0.5">
                            <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
                            <span className="text-right font-medium">{String(value ?? "—")}</span>
                          </div>
                        ))}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Run an approved analytics query to inspect risk, alerts, onboarding, or support
                backlog.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      {/* eslint-enable i18next/no-literal-string */}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, city, or owner..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(["all", "doctor", "dentist", "pharmacy"] as FilterType[]).map((t) => (
            <Button
              key={t}
              variant={typeFilter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(t)}
              className="capitalize text-xs"
            >
              {t === "all" ? "All Types" : t}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-2">
          {(["all", "active", "suspended", "trial"] as FilterStatus[]).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="capitalize text-xs"
            >
              {s === "all" ? "All" : s}
              <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                {s === "all" ? list.length : list.filter((c) => c.status === s).length}
              </Badge>
            </Button>
          ))}
        </div>
        <Separator orientation="vertical" className="h-8 mx-1 hidden sm:block" />
        {}
        <div className="flex items-center gap-1">
          <Heart className="h-4 w-4 text-muted-foreground" />
          {(["all", "excellent", "good", "fair", "at-risk"] as HealthFilter[]).map((h) => (
            <Button
              key={h}
              variant={healthFilter === h ? "default" : "outline"}
              size="sm"
              onClick={() => setHealthFilter(h)}
              className="capitalize text-xs"
            >
              {h === "all" ? "All Health" : h === "at-risk" ? "At Risk" : h}
            </Button>
          ))}
        </div>
        {}
      </div>
      {/* eslint-disable i18next/no-literal-string -- admin-only bulk action labels */}
      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg border bg-muted/50">
          <span className="text-sm font-medium">
            {selectedIds.size} clinic{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button variant="outline" size="sm" onClick={() => openBulkAction("change-tier")}>
            <Shield className="h-3.5 w-3.5 mr-1" />
            Change Tier
          </Button>
          <Button variant="outline" size="sm" onClick={() => openBulkAction("send-announcement")}>
            <Send className="h-3.5 w-3.5 mr-1" />
            Send Announcement
          </Button>
          <Button variant="outline" size="sm" onClick={() => openBulkAction("enable-feature")}>
            <Zap className="h-3.5 w-3.5 mr-1" />
            Enable Feature
          </Button>
          <Button variant="outline" size="sm" onClick={() => openBulkAction("suspend")}>
            <Ban className="h-3.5 w-3.5 mr-1" />
            Suspend
          </Button>
          <Button variant="outline" size="sm" onClick={() => openBulkAction("export")}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => openBulkAction("change-status")}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Change Status
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs"
          >
            Clear selection
          </Button>
        </div>
      )}
      {/* eslint-enable i18next/no-literal-string */}

      {loadingData ? (
        <ClinicsTableSkeleton />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="table-mobile-scroll">
              <table className="w-full text-sm">
                <thead>
                  {/* eslint-disable i18next/no-literal-string -- admin-only sortable headers */}
                  <tr className="border-b text-muted-foreground">
                    <th className="w-10 py-3 px-4">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="flex h-4 w-4 items-center justify-center rounded border border-input bg-background hover:bg-accent"
                        aria-label={allPageSelected ? "Deselect all" : "Select all"}
                      >
                        {allPageSelected ? (
                          <Check className="h-3 w-3" />
                        ) : somePageSelected ? (
                          <Minus className="h-3 w-3" />
                        ) : null}
                      </button>
                    </th>
                    <th className="text-left font-medium py-3 px-4">
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("name")}
                      >
                        Clinic
                        {sortField === "name" && <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="text-left font-medium py-3 px-4 hidden md:table-cell">Owner</th>
                    <th className="text-left font-medium py-3 px-4">Type</th>
                    <th className="text-left font-medium py-3 px-4 hidden lg:table-cell">City</th>
                    <th className="text-left font-medium py-3 px-4">Users</th>
                    <th className="text-left font-medium py-3 px-4 hidden lg:table-cell">
                      Revenue
                    </th>
                    <th className="text-left font-medium py-3 px-4">
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("plan")}
                      >
                        Plan
                        {sortField === "plan" && <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="text-left font-medium py-3 px-4">
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("health")}
                      >
                        Health
                        {sortField === "health" && <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="text-left font-medium py-3 px-4">
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("status")}
                      >
                        Status
                        {sortField === "status" && <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="text-right font-medium py-3 px-4">Actions</th>
                  </tr>
                  {/* eslint-enable i18next/no-literal-string */}
                </thead>
                <tbody>
                  {paginatedList.map((clinic) => {
                    const breakdown =
                      healthScores.get(clinic.id) ?? buildFallbackHealthScore(clinic);
                    const healthLabel = getHealthLabel(breakdown.total);
                    const isSelected = selectedIds.has(clinic.id);
                    return (
                      <tr
                        key={clinic.id}
                        className={`border-b last:border-0 hover:bg-muted/50 ${isSelected ? "bg-muted/30" : ""}`}
                      >
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => toggleSelect(clinic.id)}
                            className={`flex h-4 w-4 items-center justify-center rounded border border-input ${isSelected ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                            aria-label={
                              isSelected ? `Deselect ${clinic.name}` : `Select ${clinic.name}`
                            }
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            href={`/super-admin/clinics/${clinic.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {clinic.name}
                          </Link>
                          <p className="text-xs text-muted-foreground md:hidden">
                            {clinic.ownerName}
                          </p>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <p className="text-muted-foreground">{clinic.ownerName}</p>
                          <p className="text-xs text-muted-foreground">{clinic.ownerEmail}</p>
                        </td>
                        <td className="py-3 px-4 capitalize text-muted-foreground">
                          {clinic.type}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">
                          {clinic.city}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{clinic.userCountRange}</td>
                        <td className="py-3 px-4 hidden lg:table-cell">
                          {formatCurrency(
                            clinic.monthlyRevenue,
                            typeof locale !== "undefined" ? locale : "fr",
                            "MAD",
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              clinic.plan === "premium"
                                ? "default"
                                : clinic.plan === "standard"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {clinic.plan}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- wrapper delegates focus/blur for tooltip; no interactive role needed */}
                          <div
                            className="relative inline-flex"
                            onMouseEnter={() => setHoveredHealthId(clinic.id)}
                            onMouseLeave={() => setHoveredHealthId(null)}
                            onFocus={() => setHoveredHealthId(clinic.id)}
                            onBlur={() => setHoveredHealthId(null)}
                          >
                            <Badge
                              className={`cursor-default ${getHealthBadgeClasses(healthLabel)}`}
                            >
                              {breakdown.total} {healthLabel}
                            </Badge>
                            <HealthScoreTooltip
                              breakdown={breakdown}
                              visible={hoveredHealthId === clinic.id}
                            />
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              clinic.status === "active"
                                ? "success"
                                : clinic.status === "suspended"
                                  ? "destructive"
                                  : "warning"
                            }
                          >
                            {clinic.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="View details"
                              onClick={() => setDetail(clinic)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Login as client"
                              onClick={() => {
                                setLoginClinic(clinic);
                                setLoginOpen(true);
                              }}
                            >
                              <LogIn className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title={clinic.status === "suspended" ? "Activate" : "Suspend"}
                              className={
                                clinic.status === "suspended" ? "text-green-600" : "text-red-500"
                              }
                              onClick={() => {
                                setSuspendClinic(clinic);
                                setSuspendOpen(true);
                              }}
                            >
                              {clinic.status === "suspended" ? (
                                <CheckCircle className="h-3.5 w-3.5" />
                              ) : (
                                <Ban className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* eslint-disable i18next/no-literal-string -- admin-only empty state, pagination, and detail dialog labels */}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-muted-foreground">
                        No clinics found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination Controls */}
      {sorted.length > pageSize && (
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border rounded px-2 py-1 text-sm bg-background"
            >
              {[10, 25, 50, 100].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span>per page &middot; {sorted.length} total</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detail !== null} onOpenChange={() => setDetail(null)}>
        {detail && (
          <DialogContent
            onClose={() => setDetail(null)}
            className="max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <DialogHeader>
              <DialogTitle>{detail.name}</DialogTitle>
              <DialogDescription>Detailed clinic information and statistics</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <Users className="h-4 w-4 mx-auto mb-1 text-purple-600" />
                    <p className="text-lg font-bold">{detail.userCountRange}</p>
                    <p className="text-[10px] text-muted-foreground">Users</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-600" />
                    <p className="text-lg font-bold">
                      {formatNumber(
                        detail.monthlyRevenue,
                        typeof locale !== "undefined" ? locale : "fr",
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Revenue (MAD)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <Calendar className="h-4 w-4 mx-auto mb-1 text-blue-600" />
                    <p className="text-lg font-bold">{detail.appointmentsThisMonth}</p>
                    <p className="text-[10px] text-muted-foreground">Appts/Month</p>
                  </CardContent>
                </Card>
              </div>

              {/* eslint-enable i18next/no-literal-string */}

              {/* eslint-disable i18next/no-literal-string -- admin-only health card labels */}
              {/* Health Score Card */}
              {(() => {
                const bd = healthScores.get(detail.id) ?? buildFallbackHealthScore(detail);
                const label = getHealthLabel(bd.total);
                return (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold">Health Score</h3>
                        <Badge className={getHealthBadgeClasses(label)}>
                          {bd.total}/100 — {label}
                        </Badge>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full rounded-full transition-all ${
                            bd.total >= 80
                              ? "bg-green-500"
                              : bd.total >= 60
                                ? "bg-blue-500"
                                : bd.total >= 40
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                          }`}
                          data-width={Math.round(bd.total)}
                        />
                      </div>
                      <div className="grid grid-cols-5 gap-2 text-center text-xs">
                        {bd.categories.map((item) => (
                          <div key={item.label}>
                            <p className="font-medium">
                              {item.value}/{item.max}
                            </p>
                            <p className="text-muted-foreground text-[10px]">{item.label}</p>
                          </div>
                        ))}
                      </div>
                      {bd.source === "live" ? (
                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                          <p>
                            <span className="font-medium text-foreground">Trend:</span>{" "}
                            {formatTrendLabel(bd.trend)}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Risk:</span>{" "}
                            {bd.churnRisk ?? "unknown"}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Top risk:</span>{" "}
                            {formatSignalName(bd.topRiskSignal)}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Top strength:</span>{" "}
                            {formatSignalName(bd.topStrengthSignal)}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Live owner analytics unavailable; showing fallback heuristic score.
                        </p>
                      )}
                      <Separator className="my-4" />
                      <div>
                        <h4 className="text-sm font-semibold">Operational Narrative</h4>
                        {detailNarrativeLoading ? (
                          <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating narrative…
                          </div>
                        ) : detailNarrative ? (
                          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                            {detailNarrative}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">
                            No narrative available for this clinic yet.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
              {/* eslint-enable i18next/no-literal-string */}

              {/* eslint-disable i18next/no-literal-string -- admin-only owner / account / features info labels */}
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2">Owner Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Type:</span>
                    <span className="capitalize">{detail.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">City:</span>
                    <span>{detail.city}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Email:</span>
                    <span className="truncate">{detail.ownerEmail}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Phone:</span>
                    <span>{detail.ownerPhone}</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2">Account Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Plan: </span>
                    <Badge
                      variant={
                        detail.plan === "premium"
                          ? "default"
                          : detail.plan === "standard"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {detail.plan}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <Badge
                      variant={
                        detail.status === "active"
                          ? "success"
                          : detail.status === "suspended"
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {detail.status}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Doctors: </span>
                    <span>{detail.doctorsCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Joined: </span>
                    <span>{detail.createdAt}</span>
                  </div>
                  {detail.domain && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Domain: </span>
                      <span>{detail.domain}</span>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2">Enabled Features</h3>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(detail.features).map(([key, enabled]) => (
                    <Badge
                      key={key}
                      variant={enabled ? "success" : "secondary"}
                      className="text-[10px] capitalize"
                    >
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* eslint-enable i18next/no-literal-string */}

              {/* eslint-disable i18next/no-literal-string -- admin-only onboarding labels */}
              {/* Onboarding Checklist */}
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2">Onboarding Checklist</h3>
                {(() => {
                  const checklist = getOnboardingChecklist(detail);
                  const completedCount = checklist.filter((item) => item.done).length;
                  const completionPct = Math.round((completedCount / checklist.length) * 100);
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          {completedCount}/{checklist.length} completed
                        </span>
                        <span className="text-xs font-medium">{completionPct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          data-width={Math.round(completionPct)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        {checklist.map((item) => {
                          const Icon = item.icon;
                          return (
                            <div key={item.label} className="flex items-center gap-2 text-sm">
                              {item.done ? (
                                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-muted-foreground shrink-0" />
                              )}
                              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span
                                className={item.done ? "text-muted-foreground line-through" : ""}
                              >
                                {item.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
              {/* eslint-enable i18next/no-literal-string */}
            </div>
            {/* eslint-disable i18next/no-literal-string -- admin-only dialog footer, login-as-client, and suspend dialog labels */}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetail(null)}>
                Close
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setLoginClinic(detail);
                  setLoginOpen(true);
                  setDetail(null);
                }}
              >
                <LogIn className="h-4 w-4 mr-1" />
                Login as Client
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Login As Dialog */}
      <Dialog
        open={loginOpen}
        onOpenChange={(open) => {
          setLoginOpen(open);
          if (!open) {
            setImpersonateReason("");
            setImpersonatePassword("");
          }
        }}
      >
        {loginClinic && (
          <DialogContent
            onClose={() => {
              setLoginOpen(false);
              setImpersonateReason("");
              setImpersonatePassword("");
            }}
          >
            <DialogHeader>
              <DialogTitle>Login as Client</DialogTitle>
              <DialogDescription>
                You are about to impersonate <strong>{loginClinic.name}</strong>. This will be
                logged for security purposes. Session expires after 30 minutes.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium">{loginClinic.name}</p>
              <p className="text-xs text-muted-foreground">
                Owner: {loginClinic.ownerName} &middot; {loginClinic.city}
              </p>
            </div>
            <div className="space-y-2">
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- control is associated via adjacent Input/sibling element */}
              <label className="text-sm font-medium">
                Reason for impersonation <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Investigating billing issue reported by clinic"
                value={impersonateReason}
                onChange={(e) => setImpersonateReason(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- control is associated via adjacent Input/sibling element */}
              <label className="text-sm font-medium">
                Re-enter your password <span className="text-red-500">*</span>
              </label>
              <Input
                type="password"
                placeholder="Your admin password"
                value={impersonatePassword}
                onChange={(e) => setImpersonatePassword(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setLoginOpen(false);
                  setImpersonateReason("");
                  setImpersonatePassword("");
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={actionLoading || impersonateReason.length < 3 || !impersonatePassword}
                onClick={async () => {
                  setActionLoading(true);
                  try {
                    const res = await fetch("/api/impersonate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        clinicId: loginClinic.id,
                        clinicName: loginClinic.name,
                        reason: impersonateReason,
                        password: impersonatePassword,
                      }),
                    });
                    if (res.ok) {
                      setLoginOpen(false);
                      setImpersonateReason("");
                      setImpersonatePassword("");
                      router.push("/admin/dashboard");
                    } else {
                      const data = await res.json();
                      addToast(data.error || "Impersonation failed", "error");
                    }
                  } catch (err) {
                    logger.warn("Failed to update clinic status", { context: "page", error: err });
                    addToast("Failed to start impersonation", "error");
                  } finally {
                    setActionLoading(false);
                  }
                }}
              >
                {actionLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <LogIn className="h-4 w-4 mr-1" />
                Continue as {loginClinic.ownerName.split(" ")[0] || "Admin"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Suspend/Activate Dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        {suspendClinic && (
          <DialogContent onClose={() => setSuspendOpen(false)}>
            <DialogHeader>
              <DialogTitle>
                {suspendClinic.status === "suspended" ? "Activate" : "Suspend"} Clinic
              </DialogTitle>
              <DialogDescription>
                {suspendClinic.status === "suspended"
                  ? "Reactivate this clinic? They will regain access to all features."
                  : "Suspend this clinic? They will lose access to all features immediately."}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium">{suspendClinic.name}</p>
              <p className="text-xs text-muted-foreground">
                {suspendClinic.userCountRange} users &middot;{" "}
                {formatCurrency(
                  suspendClinic.monthlyRevenue,
                  typeof locale !== "undefined" ? locale : "fr",
                  "MAD",
                )}
                /mo
              </p>
            </div>
            {suspendClinic.status !== "suspended" && (
              <div className="space-y-2">
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- control is associated via adjacent Input/sibling element */}
                <label className="text-sm font-medium">Type the clinic name to confirm:</label>
                <Input
                  placeholder={suspendClinic.name}
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                />
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSuspendOpen(false);
                  setConfirmName("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant={suspendClinic.status === "suspended" ? "default" : "destructive"}
                onClick={() => {
                  toggleStatus(suspendClinic);
                  setConfirmName("");
                }}
                disabled={
                  actionLoading ||
                  (suspendClinic.status !== "suspended" && confirmName !== suspendClinic.name)
                }
              >
                {actionLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {suspendClinic.status === "suspended" ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Activate
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4 mr-1" />
                    Suspend
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      {/* eslint-enable i18next/no-literal-string */}

      {/* eslint-disable i18next/no-literal-string -- admin-only bulk action dialog labels */}
      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={bulkAction !== null} onOpenChange={() => setBulkAction(null)}>
        {bulkAction && (
          <DialogContent onClose={() => setBulkAction(null)} className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{getBulkDialogTitle()}</DialogTitle>
              <DialogDescription>
                Apply {getBulkDialogTitle().toLowerCase()} to {selectedClinics.length} clinic
                {selectedClinics.length !== 1 ? "s" : ""}?
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border p-3 bg-muted/50 max-h-32 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground mb-1">Affected clinics:</p>
              <div className="flex flex-wrap gap-1">
                {selectedClinics.map((c) => (
                  <Badge key={c.id} variant="secondary" className="text-xs">
                    {c.name}
                  </Badge>
                ))}
              </div>
            </div>

            {bulkAction === "change-tier" && (
              <div className="space-y-2">
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- control is associated via adjacent select */}
                <label className="text-sm font-medium">Select new tier</label>
                <select
                  value={bulkActionValue}
                  onChange={(e) => setBulkActionValue(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="">Choose tier...</option>
                  {TIER_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {bulkAction === "send-announcement" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- control is associated via adjacent Input */}
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="Announcement title"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- control is associated via adjacent textarea */}
                  <label className="text-sm font-medium">Message</label>
                  <textarea
                    placeholder="Announcement message..."
                    value={announcementBody}
                    onChange={(e) => setAnnouncementBody(e.target.value)}
                    rows={3}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
                  />
                </div>
              </div>
            )}

            {bulkAction === "enable-feature" && (
              <div className="space-y-2">
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- control is associated via adjacent select */}
                <label className="text-sm font-medium">Select feature</label>
                <select
                  value={bulkActionValue}
                  onChange={(e) => setBulkActionValue(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="">Choose feature...</option>
                  {FEATURE_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f
                        .split("-")
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(" ")}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {bulkAction === "suspend" && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3">
                <p className="text-sm text-red-800 dark:text-red-400">
                  This will immediately suspend {selectedClinics.length} clinic
                  {selectedClinics.length !== 1 ? "s" : ""}. They will lose access to all features.
                </p>
              </div>
            )}

            {bulkAction === "change-status" && (
              <div className="space-y-2">
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- control is associated via adjacent select */}
                <label className="text-sm font-medium">Select status</label>
                <select
                  value={bulkActionValue}
                  onChange={(e) => setBulkActionValue(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="">Choose status...</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkAction(null)}>
                Cancel
              </Button>
              <Button
                variant={bulkAction === "suspend" ? "destructive" : "default"}
                onClick={executeBulkAction}
                disabled={
                  (bulkAction === "change-tier" && !bulkActionValue) ||
                  (bulkAction === "enable-feature" && !bulkActionValue) ||
                  (bulkAction === "change-status" && !bulkActionValue) ||
                  (bulkAction === "send-announcement" && (!announcementTitle || !announcementBody))
                }
              >
                {bulkAction === "suspend" ? (
                  <>
                    <Ban className="h-4 w-4 mr-1" />
                    Suspend {selectedClinics.length} Clinic{selectedClinics.length !== 1 ? "s" : ""}
                  </>
                ) : (
                  <>
                    Apply to {selectedClinics.length} Clinic
                    {selectedClinics.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      {/* eslint-enable i18next/no-literal-string */}
    </div>
  );
}
