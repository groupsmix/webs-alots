/* eslint-disable i18next/no-literal-string -- French UI strings */
"use client";

import {
  Video,
  VideoOff,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Phone,
  Clock,
  Calendar,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface TelemedicineSession {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  status: string;
  room_url: string | null;
  consultation_notes: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Planifiée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
  no_show: "Absent",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "outline",
  in_progress: "default",
  completed: "secondary",
  cancelled: "destructive",
  no_show: "destructive",
};

export function TelemedicineDashboard() {
  const [sessions, setSessions] = useState<TelemedicineSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const limit = 20;

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/telemedicine?${params}`);
      const json = await res.json();
      if (json.ok) {
        setSessions(json.data.sessions);
        setTotal(json.data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch(`/api/telemedicine/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) fetchSessions();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Télémédecine</h2>
          <p className="text-muted-foreground">Consultations vidéo avec les patients</p>
        </div>
        <button
          onClick={fetchSessions}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium">Planifiées</span>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {sessions.filter((s) => s.status === "scheduled").length}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium">En cours</span>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {sessions.filter((s) => s.status === "in_progress").length}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Terminées aujourd&apos;hui</span>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {sessions.filter((s) => s.status === "completed").length}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="scheduled">Planifiée</option>
          <option value="in_progress">En cours</option>
          <option value="completed">Terminée</option>
          <option value="cancelled">Annulée</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <VideoOff className="h-12 w-12" />
          <p>Aucune session de télémédecine trouvée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/30"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANTS[session.status] ?? "default"}>
                    {STATUS_LABELS[session.status] ?? session.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(session.scheduled_at).toLocaleString("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <p className="text-sm">
                  Patient: <span className="font-mono">{session.patient_id.slice(0, 8)}...</span>
                </p>
                {session.duration_minutes && (
                  <p className="text-xs text-muted-foreground">
                    Durée: {session.duration_minutes} min
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {session.status === "scheduled" && (
                  <button
                    onClick={() => handleStatusChange(session.id, "in_progress")}
                    className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
                  >
                    <Video className="h-4 w-4" />
                    Démarrer
                  </button>
                )}
                {session.status === "in_progress" && (
                  <>
                    {session.room_url && (
                      <a
                        href={session.room_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                      >
                        <Phone className="h-4 w-4" />
                        Rejoindre
                      </a>
                    )}
                    <button
                      onClick={() => handleStatusChange(session.id, "completed")}
                      className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-accent"
                    >
                      Terminer
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} session{total !== 1 ? "s" : ""} au total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border p-2 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border p-2 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
