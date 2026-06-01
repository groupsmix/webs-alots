"use client";

import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Users,
  Clock,
  Calendar,
  Plus,
  Loader2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader } from "@/components/ui/page-loader";
import { getCurrentUser } from "@/lib/data/client";

interface TelemedicineSession {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  scheduled_at: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  room_url: string | null;
  consultation_notes: string | null;
  patient_name?: string;
}

interface VideoTokenData {
  token: string;
  room_name: string;
  identity: string;
  room_url: string;
}

const STATUS_LABELS: Record<TelemedicineSession["status"], string> = {
  scheduled: "Planifiée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

const STATUS_VARIANTS: Record<
  TelemedicineSession["status"],
  "default" | "success" | "warning" | "destructive"
> = {
  scheduled: "default",
  in_progress: "warning",
  completed: "success",
  cancelled: "destructive",
};

export default function TelemedicinePage() {
  const [sessions, setSessions] = useState<TelemedicineSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<TelemedicineSession | null>(null);
  const [videoToken, setVideoToken] = useState<VideoTokenData | null>(null);
  const [joiningSession, setJoiningSession] = useState<string | null>(null);
  const [creatingRoom, setCreatingRoom] = useState<string | null>(null);

  // Video call UI state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await getCurrentUser();
      if (!user?.clinic_id) {
        setError("Contexte clinique introuvable.");
        return;
      }
      const res = await fetch(
        `/api/telemedicine?doctor_id=${user.id}&limit=20`,
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

  const handleCreateRoom = async (session: TelemedicineSession) => {
    setCreatingRoom(session.id);
    try {
      const res = await fetch("/api/telemedicine/create-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id }),
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? "Échec de création de la salle");
      }
      const data = await res.json();
      setSessions((prev) =>
        prev.map((s) =>
          s.id === session.id
            ? { ...s, room_url: data.data?.room?.url, status: "in_progress" }
            : s
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur lors de la création de salle");
    } finally {
      setCreatingRoom(null);
    }
  };

  const handleJoinSession = async (session: TelemedicineSession) => {
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
        throw new Error(errData.error ?? "Échec de connexion à la salle");
      }
      const data = await res.json();
      setVideoToken(data.data);
      setActiveSession(session);
      setCallDuration(0);
      callTimerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur lors de la connexion à la salle");
    } finally {
      setJoiningSession(null);
    }
  };

  const handleEndCall = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setActiveSession(null);
    setVideoToken(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
    loadSessions();
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (loading) return <PageLoader message="Chargement des sessions..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Télémédecine</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gérez vos consultations vidéo avec vos patients
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadSessions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => window.location.href = "/doctor/telemedicine/new"}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Session
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Active Call Banner */}
      {activeSession && videoToken && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-300"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? (
                    <MicOff className="h-4 w-4 text-red-500" />
                  ) : (
                    <Mic className="h-4 w-4 text-green-600" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-300"
                  onClick={() => setIsVideoOff(!isVideoOff)}
                >
                  {isVideoOff ? (
                    <VideoOff className="h-4 w-4 text-red-500" />
                  ) : (
                    <Video className="h-4 w-4 text-green-600" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-300"
                  onClick={() =>
                    window.open(videoToken.room_url, "_blank", "noopener,noreferrer")
                  }
                >
                  <ExternalLink className="h-4 w-4 text-green-600 mr-1" />
                  Ouvrir
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleEndCall}
                >
                  <PhoneOff className="h-4 w-4 mr-1" />
                  Terminer
                </Button>
              </div>
            </div>

            {/* Token info for Twilio SDK integration */}
            <div className="mt-3 rounded border border-green-200 bg-white/50 dark:bg-black/20 p-2 text-xs text-muted-foreground">
              <span className="font-medium">Salle:</span> {videoToken.room_name} &nbsp;|&nbsp;
              <span className="font-medium">Identité:</span> {videoToken.identity}
              {isMuted && <span className="ml-2 text-red-500">🎤 Micro coupé</span>}
              {isVideoOff && <span className="ml-2 text-red-500">📷 Caméra désactivée</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Video className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium">Aucune session de télémédecine</p>
            <p className="text-sm text-muted-foreground mt-1">
              Créez une nouvelle session pour démarrer une consultation vidéo
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card key={session.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        Session {session.id.slice(0, 8)}...
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {new Date(session.scheduled_at).toLocaleString("fr-MA", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      {session.consultation_notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                          {session.consultation_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANTS[session.status]}>
                      {STATUS_LABELS[session.status]}
                    </Badge>

                    {/* Create room if not yet created */}
                    {session.status === "scheduled" && !session.room_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCreateRoom(session)}
                        disabled={creatingRoom === session.id}
                      >
                        {creatingRoom === session.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Video className="h-4 w-4 mr-1" />
                        )}
                        Créer salle
                      </Button>
                    )}

                    {/* Join room if ready */}
                    {(session.status === "scheduled" || session.status === "in_progress") &&
                      session.room_url && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleJoinSession(session)}
                          disabled={joiningSession === session.id || !!activeSession}
                        >
                          {joiningSession === session.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Video className="h-4 w-4 mr-1" />
                          )}
                          Rejoindre
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
