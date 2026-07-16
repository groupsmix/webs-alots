"use client";

import {
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  User,
  Calendar,
  CreditCard,
  Settings,
  Lock,
  Activity,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface AuditLogEntry {
  id: string;
  action: string;
  type: string;
  actor: string | null;
  clinic_id: string | null;
  clinic_name: string | null;
  description: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string | null;
  created_at: string | null;
}

interface AuditLogResponse {
  ok: boolean;
  data: {
    logs: AuditLogEntry[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

const EVENT_TYPES = [
  { value: "", label: "Tous les types" },
  { value: "booking", label: "Rendez-vous" },
  { value: "patient", label: "Patient" },
  { value: "payment", label: "Paiement" },
  { value: "admin", label: "Administration" },
  { value: "auth", label: "Authentification" },
  { value: "config", label: "Configuration" },
  { value: "security", label: "Sécurité" },
] as const;

const TYPE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  booking: Calendar,
  patient: User,
  payment: CreditCard,
  admin: Settings,
  auth: Lock,
  config: Settings,
  security: Shield,
};

const TYPE_BADGE_MAP: Record<
  string,
  "default" | "secondary" | "destructive" | "warning" | "success" | "outline"
> = {
  booking: "default",
  patient: "secondary",
  payment: "success",
  admin: "outline",
  auth: "warning",
  config: "outline",
  security: "destructive",
};

function formatTimestamp(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("fr-FR", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (typeFilter) params.set("type", typeFilter);
    if (searchQuery) params.set("search", searchQuery);
    if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
    if (dateTo) params.set("to", new Date(dateTo + "T23:59:59").toISOString());

    try {
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const json: AuditLogResponse = await res.json();

      if (!json.ok) {
        setError("Erreur lors du chargement des journaux d'audit");
        return;
      }

      setLogs(json.data.logs);
      setTotal(json.data.total);
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, searchQuery, dateFrom, dateTo]);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        fetchLogs();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par action ou description..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border bg-background px-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Filtrer par type"
        >
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Date de début"
        />

        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Date de fin"
        />

        <button
          onClick={fetchLogs}
          className="rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted transition-colors"
          aria-label="Rafraîchir"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Results summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} entrée{total !== 1 ? "s" : ""} trouvée{total !== 1 ? "s" : ""}
        </span>
        {totalPages > 1 && (
          <span>
            Page {page} / {totalPages}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-start font-medium">Date</th>
              <th className="px-4 py-3 text-start font-medium">Type</th>
              <th className="px-4 py-3 text-start font-medium">Action</th>
              <th className="px-4 py-3 text-start font-medium">Utilisateur</th>
              <th className="px-4 py-3 text-start font-medium">Description</th>
              <th className="px-4 py-3 text-start font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  <Activity className="h-5 w-5 animate-pulse mx-auto mb-2" />
                  Chargement...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Aucune entrée trouvée
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const Icon = TYPE_ICON_MAP[log.type] ?? Activity;
                const badgeVariant = TYPE_BADGE_MAP[log.type] ?? "outline";
                return (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={badgeVariant} className="gap-1">
                        <Icon className="h-3 w-3" />
                        {log.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">{log.action}</td>
                    <td className="px-4 py-3 text-muted-foreground">{log.actor ?? "—"}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">
                      {log.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono text-xs">
                      {log.ip_address ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
