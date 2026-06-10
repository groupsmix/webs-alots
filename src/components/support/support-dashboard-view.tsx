"use client";

import {
  MessageSquare,
  Clock,
  Star,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Mail,
  Globe,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardData {
  summary: {
    open: number;
    in_progress: number;
    resolved: number;
    closed: number;
    total: number;
    avg_satisfaction: number | null;
    avg_response_time_minutes: number | null;
  };
  channel_breakdown: Record<string, number>;
  language_breakdown: Record<string, number>;
  recent_tickets: Array<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    channel: string;
    language: string | null;
    patient_name: string | null;
    patient_phone: string | null;
    assigned_to: string | null;
    satisfaction_rating: number | null;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    ai_urgency: string | null;
    ai_summary: string | null;
    ai_draft_reply: string | null;
    ai_tags: string[] | null;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const AI_URGENCY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 border-gray-300",
  normal: "bg-blue-100 text-blue-700 border-blue-300",
  high: "bg-orange-100 text-orange-700 border-orange-300",
  urgent: "bg-red-200 text-red-800 border-red-400 animate-pulse",
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  chat: <MessageSquare className="h-4 w-4" />,
  whatsapp: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
};

const LANGUAGE_LABELS: Record<string, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
};

export function SupportDashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const didMount = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/support/dashboard");
      if (!res.ok) throw new Error("Impossible de charger les données du tableau de bord");
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      void fetchData();
    }
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <h1 className="text-2xl font-bold">Tableau de bord support</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <h1 className="text-2xl font-bold mb-4">Tableau de bord support</h1>
        <Card>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <CardContent className="p-6 text-red-600">Erreur : {error}</CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { summary, channel_breakdown, language_breakdown, recent_tickets } = data;

  return (
    <div className="space-y-6 p-6">
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <h1 className="text-2xl font-bold">Tableau de bord support</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <CardTitle className="text-sm font-medium">Tickets ouverts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.open}</div>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <p className="text-xs text-muted-foreground">{summary.in_progress} en cours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <CardTitle className="text-sm font-medium">Résolus</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.resolved}</div>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <p className="text-xs text-muted-foreground">{summary.total} tickets au total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <CardTitle className="text-sm font-medium">Temps de réponse moyen</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.avg_response_time_minutes != null
                ? `${summary.avg_response_time_minutes}m`
                : "—"}
            </div>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <p className="text-xs text-muted-foreground">minutes pour résoudre</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
            <Star className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.avg_satisfaction != null ? `${summary.avg_satisfaction}/5` : "—"}
            </div>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <p className="text-xs text-muted-foreground">note moyenne</p>
          </CardContent>
        </Card>
      </div>

      {/* Channel & Language Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <CardTitle className="text-sm font-medium">Par canal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(channel_breakdown).map(([channel, count]) => (
                <div key={channel} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {CHANNEL_ICONS[channel] ?? <Globe className="h-4 w-4" />}
                    <span className="text-sm capitalize">{channel}</span>
                  </div>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
              {/* eslint-disable i18next/no-literal-string */}
              {Object.keys(channel_breakdown).length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune donnée</p>
              )}
              {/* eslint-enable i18next/no-literal-string */}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <CardTitle className="text-sm font-medium">Par langue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(language_breakdown).map(([lang, count]) => (
                <div key={lang} className="flex items-center justify-between">
                  <span className="text-sm">{LANGUAGE_LABELS[lang] ?? lang}</span>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
              {/* eslint-disable i18next/no-literal-string */}
              {Object.keys(language_breakdown).length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune donnée</p>
              )}
              {/* eslint-enable i18next/no-literal-string */}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <CardTitle className="text-sm font-medium">Tickets récents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {/* eslint-disable i18next/no-literal-string */}
                  <th className="text-left py-2 px-2">Sujet</th>
                  <th className="text-left py-2 px-2">Statut</th>
                  <th className="text-left py-2 px-2">Priorité</th>
                  <th className="text-left py-2 px-2">AI Urgence</th>
                  <th className="text-left py-2 px-2">Canal</th>
                  <th className="text-left py-2 px-2">Patient</th>
                  <th className="text-left py-2 px-2">Créé</th>
                  {/* eslint-enable i18next/no-literal-string */}
                </tr>
              </thead>
              <tbody>
                {recent_tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 max-w-[200px] truncate">{ticket.subject}</td>
                    <td className="py-2 px-2">
                      <Badge variant="outline" className={STATUS_COLORS[ticket.status] ?? ""}>
                        {ticket.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant="outline" className={PRIORITY_COLORS[ticket.priority] ?? ""}>
                        {ticket.priority}
                      </Badge>
                    </td>
                    <td className="py-2 px-2">
                      {ticket.ai_urgency ? (
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant="outline"
                            className={AI_URGENCY_COLORS[ticket.ai_urgency] ?? ""}
                          >
                            {}
                            {"AI: "}
                            {ticket.ai_urgency}
                          </Badge>
                          {ticket.ai_summary && (
                            <span
                              className="text-xs text-muted-foreground truncate max-w-[150px]"
                              title={ticket.ai_summary}
                            >
                              {ticket.ai_summary}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{"—"}</span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1">
                        {CHANNEL_ICONS[ticket.channel] ?? <Globe className="h-3 w-3" />}
                        <span className="capitalize">{ticket.channel}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2">{ticket.patient_name ?? "—"}</td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {recent_tickets.length === 0 && (
                  <tr>
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      Aucun ticket
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
