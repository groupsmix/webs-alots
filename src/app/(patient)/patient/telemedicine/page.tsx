"use client";

import {
  Video,
  Calendar,
  Clock,
  Loader2,
  PhoneOff,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import { getCurrentUser } from "@/lib/data/client";

interface TelemedicineSession {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_at: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  room_url: string | null;
  consultation_notes: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Planifiée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

const STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "destructive"> = {
  scheduled: "default",
  in_progress: "warning",
  completed: "success",
  cancelled: "destructive",
};

export default function PatientTelemedicinePage() {
  const [sessions, setSessions] = useState<TelemedicineSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningSession, setJoiningSession] = useState<string | null>(null);
  const [activeRoomUrl, setActiveRoomUrl] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await getCurrentUser();
      if (!user?.id) {
        setError("Utilisateur introuvable.");
        return;
      }
      const res = await fetch(
        `/api/telemedicine?patient_id=${user.id}&limit=20`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Échec du chargement");
      const data = await res.json();
      setSessions(data.data?.sessions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleJoin = async (session: TelemedicineSession) => {
    if (!session.room_url) {
      alert("La salle n'est pas encore prête. Veuillez patienter que le médecin l'ouvre.");
      return;
    }

    setJoiningSession(session.id);
    try {
      const res = await fetch("/api/telemedicine/join-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id }),
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? "Impossible de rejoindre la session");
      }
      const data = await res.json();
      setActiveRoomUrl(data.data?.room_url ?? session.room_url);
      setCallDuration(0);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur lors de la connexion");
    } finally {
      setJoiningSession(null);
    }
  };

  const handleLeave = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setActiveRoomUrl(null);
    setCallDuration(0);
    loadSessions();
  };

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (loading) return <PageLoader message="Chargement de vos consultations..." />;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mes Consultations Vidéo</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Rejoignez vos consultations de télémédecine ici
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSessions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Active call banner */}
      {activeRoomUrl && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300">
                  Consultation en cours
                </p>
                <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(callDuration)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-green-300"
                onClick={() => window.open(activeRoomUrl, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-4 w-4 mr-1 text-green-600" />
                Ouvrir la salle
              </Button>
              <Button size="sm" variant="destructive" onClick={handleLeave}>
                <PhoneOff className="h-4 w-4 mr-1" />
                Terminer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session list */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Video className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium">Aucune consultation vidéo planifiée</p>
            <p className="text-sm text-muted-foreground mt-1">
              Votre médecin vous enverra un lien lorsqu&apos;une consultation est prête
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card key={session.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-medium text-sm">
                      Consultation du{" "}
                      {new Date(session.scheduled_at).toLocaleDateString("fr-MA", {
                        dateStyle: "long",
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="h-3 w-3" />
                      {new Date(session.scheduled_at).toLocaleTimeString("fr-MA", {
                        timeStyle: "short",
                      })}
                    </p>
                    {session.consultation_notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {session.consultation_notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANTS[session.status] ?? "default"}>
                      {STATUS_LABELS[session.status] ?? session.status}
                    </Badge>

                    {(session.status === "scheduled" || session.status === "in_progress") && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleJoin(session)}
                        disabled={joiningSession === session.id || !!activeRoomUrl}
                      >
                        {joiningSession === session.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Video className="h-4 w-4 mr-1" />
                        )}
                        {session.room_url ? "Rejoindre" : "En attente du médecin"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
