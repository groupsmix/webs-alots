"use client";

import { Clock, Bell, Stethoscope, Users, Maximize } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { HealthTipsWidget } from "@/components/morocco/health-tips";
import { PrayerTimesWidget } from "@/components/morocco/prayer-times";
import { formatDisplayDate } from "@/lib/utils";

interface QueuePatient {
  id: string;
  ticketNumber: number;
  name: string;
  status: "waiting" | "called" | "in-consultation";
  estimatedWait: number; // minutes
  checkedInAt?: string; // ISO date string for wait time calculation
}

interface TVQueueDisplayProps {
  clinicName: string;
  patients: QueuePatient[];
  currentNumber: number;
  /** Locale for display text */
  locale?: "fr" | "ar";
  /** Clinic logo URL (from branding settings) */
  logoUrl?: string;
  /** Primary brand color (hex) */
  primaryColor?: string;
  /** City for prayer times (default: Casablanca) */
  city?: string;
  /** Average consultation duration in minutes (for wait time estimation) */
  avgConsultationMinutes?: number;
  /** Callback when component mounts — used for Realtime subscription */
  onRealtimeSubscribe?: (callback: (patients: QueuePatient[]) => void) => (() => void) | void;
}

const LABELS = {
  fr: {
    title: "File d'attente",
    currentlyServing: "En cours",
    nextPatients: "Prochains patients",
    waiting: "En attente",
    called: "Appelé",
    inConsultation: "En consultation",
    estimatedWait: "Attente estimée",
    minutes: "min",
    yourTurn: "C'est votre tour !",
    pleaseWait: "Merci de patienter",
    totalWaiting: "patients en attente",
    fullscreen: "Plein écran",
    noPatients: "Pas de patients en attente",
  },
  ar: {
    title: "الطابور",
    currentlyServing: "قيد الاستشارة",
    nextPatients: "المرضى التالون",
    waiting: "في الانتظار",
    called: "تم الاستدعاء",
    inConsultation: "في الاستشارة",
    estimatedWait: "وقت الانتظار المتوقع",
    minutes: "دقيقة",
    yourTurn: "!جا دورك",
    pleaseWait: "المرجو الانتظار",
    totalWaiting: "مرضى في الانتظار",
    fullscreen: "شاشة كاملة",
    noPatients: "لا يوجد مرضى في الانتظار",
  },
};

/**
 * Calculate estimated wait time for each patient based on their position
 * in the queue and the average consultation duration.
 */
function calculateEstimatedWait(
  patients: QueuePatient[],
  avgMinutes: number,
): QueuePatient[] {
  const waiting = patients.filter((p) => p.status === "waiting");
  return patients.map((p) => {
    if (p.status !== "waiting") return p;
    const position = waiting.findIndex((w) => w.id === p.id);
    return {
      ...p,
      estimatedWait: position >= 0 ? (position + 1) * avgMinutes : p.estimatedWait,
    };
  });
}

/**
 * TVQueueDisplay
 *
 * Production-ready TV display for clinic waiting rooms.
 * Features:
 * - Clinic logo and branding colors
 * - Estimated wait times based on average consultation duration
 * - Prayer times widget (Aladhan API)
 * - Rotating health tips in French/Darija
 * - Auto-refresh via Supabase Realtime subscription
 * - Fullscreen mode with Wake Lock API (prevents screen sleep)
 *
 * Designed for large screens (TV/monitor in waiting room).
 */
export function TVQueueDisplay({
  clinicName,
  patients: initialPatients,
  currentNumber,
  locale = "fr",
  logoUrl,
  primaryColor,
  city = "Casablanca",
  avgConsultationMinutes = 15,
  onRealtimeSubscribe,
}: TVQueueDisplayProps) {
  const [time, setTime] = useState(new Date());
  const [flashCalled, setFlashCalled] = useState(false);
  const [patients, setPatients] = useState(() =>
    calculateEstimatedWait(initialPatients, avgConsultationMinutes),
  );
  const [, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const labels = LABELS[locale];
  const isRTL = locale === "ar";

  // Dynamic gradient based on branding color
  const gradientStyle = primaryColor
    ? {
        background: `linear-gradient(135deg, ${primaryColor}dd 0%, ${primaryColor}99 50%, ${primaryColor}77 100%)`,
      }
    : undefined;

  // Clock timer
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Update patients when props change
  useEffect(() => {
    setPatients(calculateEstimatedWait(initialPatients, avgConsultationMinutes));
  }, [initialPatients, avgConsultationMinutes]);

  // Supabase Realtime subscription for live updates
  useEffect(() => {
    if (!onRealtimeSubscribe) return;
    const cleanup = onRealtimeSubscribe((updatedPatients) => {
      setPatients(calculateEstimatedWait(updatedPatients, avgConsultationMinutes));
    });
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [onRealtimeSubscribe, avgConsultationMinutes]);

  // Flash effect when a patient is called
  const calledTicket = patients.find((p) => p.status === "called")?.ticketNumber;
  useEffect(() => {
    if (calledTicket != null) {
      const timer1 = setTimeout(() => setFlashCalled(true), 0);
      const timer2 = setTimeout(() => setFlashCalled(false), 3000);
      return () => { clearTimeout(timer1); clearTimeout(timer2); };
    }
  }, [calledTicket]);

  // Wake Lock API — prevent screen from sleeping
  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Wake Lock can fail silently (e.g., low battery, tab not visible)
      }
    }

    requestWakeLock();

    // Re-acquire wake lock when page becomes visible again
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen may not be supported or allowed
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const inConsultation = patients.find((p) => p.status === "in-consultation");
  const calledPatient = patients.find((p) => p.status === "called");
  const waitingPatients = patients.filter((p) => p.status === "waiting");
  const nextFive = waitingPatients.slice(0, 5);

  return (
    <div
      ref={containerRef}
      className={`min-h-screen text-white flex flex-col ${isRTL ? "rtl" : "ltr"} ${
        !primaryColor ? "bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900" : ""
      }`}
      style={gradientStyle}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Header with branding */}
      <div className="flex items-center justify-between px-8 py-4 bg-black/20">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={clinicName}
              className="h-12 w-12 rounded-xl object-contain bg-white/10 p-1"
            />
          ) : (
            <Stethoscope className="h-8 w-8 text-blue-300" />
          )}
          <h1 className="text-2xl font-bold">{clinicName}</h1>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title={labels.fullscreen}
          >
            <Maximize className="h-5 w-5" />
          </button>
          <div className={isRTL ? "text-left" : "text-right"}>
            <p className="text-3xl font-mono font-bold">
              {time.toLocaleTimeString(locale === "ar" ? "ar-MA" : "fr-MA", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="text-sm text-blue-200">
              {formatDisplayDate(time, locale === "ar" ? "ar" : "fr", "long")}
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-6 p-8">
        {/* Left: Current number (large) */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Currently being served */}
          <div className="text-center mb-8">
            <p className="text-lg text-blue-200 mb-2 flex items-center justify-center gap-2">
              <Stethoscope className="h-5 w-5" />
              {labels.currentlyServing}
            </p>
            <div
              className={`w-64 h-64 rounded-full flex items-center justify-center mx-auto transition-all duration-500 ${
                flashCalled
                  ? "bg-green-500 animate-pulse shadow-2xl shadow-green-500/50"
                  : "bg-white/10 border-4 border-white/30"
              }`}
            >
              <span className="text-8xl font-bold font-mono">
                {String(currentNumber).padStart(2, "0")}
              </span>
            </div>
            {inConsultation && (
              <p className="text-xl mt-4 text-blue-100">
                {inConsultation.name}
              </p>
            )}
          </div>

          {/* Called patient notification */}
          {calledPatient && (
            <div className="bg-green-500/90 rounded-2xl px-8 py-6 text-center animate-bounce shadow-2xl">
              <Bell className="h-8 w-8 mx-auto mb-2" />
              <p className="text-3xl font-bold mb-1">
                N° {String(calledPatient.ticketNumber).padStart(2, "0")}
              </p>
              <p className="text-xl">{labels.yourTurn}</p>
              <p className="text-lg text-green-100">{calledPatient.name}</p>
            </div>
          )}
        </div>

        {/* Right: Queue list + widgets */}
        <div className="w-96 flex flex-col gap-4">
          <div className="bg-white/10 rounded-2xl p-6 flex-1 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5" />
                {labels.nextPatients}
              </h2>
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                {waitingPatients.length} {labels.totalWaiting}
              </span>
            </div>

            <div className="space-y-3">
              {nextFive.map((patient, index) => (
                <div
                  key={patient.id}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    index === 0
                      ? "bg-yellow-500/20 border border-yellow-400/30"
                      : "bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                        index === 0
                          ? "bg-yellow-500 text-yellow-900"
                          : "bg-white/10"
                      }`}
                    >
                      {String(patient.ticketNumber).padStart(2, "0")}
                    </div>
                    <div>
                      <p className="font-medium text-lg">{patient.name}</p>
                      <p className="text-sm text-blue-200 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        ~{patient.estimatedWait} {labels.minutes}
                      </p>
                    </div>
                  </div>
                  {index === 0 && (
                    <span className="text-xs bg-yellow-500/30 text-yellow-200 px-2 py-1 rounded-full">
                      {labels.nextPatients}
                    </span>
                  )}
                </div>
              ))}

              {waitingPatients.length > 5 && (
                <div className="text-center text-blue-300 text-sm py-2">
                  +{waitingPatients.length - 5} {labels.totalWaiting}
                </div>
              )}

              {waitingPatients.length === 0 && (
                <div className="text-center py-12 text-blue-300">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg">{labels.noPatients}</p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold">{waitingPatients.length}</p>
              <p className="text-xs text-blue-200">{labels.waiting}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold">
                ~{waitingPatients.length > 0 ? waitingPatients[waitingPatients.length - 1].estimatedWait : 0}
              </p>
              <p className="text-xs text-blue-200">{labels.estimatedWait} ({labels.minutes})</p>
            </div>
          </div>

          {/* Prayer Times Widget */}
          <PrayerTimesWidget city={city} locale={locale} />

          {/* Health Tips Widget */}
          <HealthTipsWidget locale={locale} />
        </div>
      </div>

      {/* Footer ticker */}
      <div className="bg-black/30 px-8 py-3 text-center text-sm text-blue-200">
        {labels.pleaseWait} — {clinicName}
      </div>
    </div>
  );
}
