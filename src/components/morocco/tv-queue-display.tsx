"use client";

import { useState, useEffect } from "react";
import { Clock, Bell, Stethoscope, Users } from "lucide-react";

interface QueuePatient {
  id: string;
  ticketNumber: number;
  name: string;
  status: "waiting" | "called" | "in-consultation";
  estimatedWait: number; // minutes
}

interface TVQueueDisplayProps {
  clinicName: string;
  patients: QueuePatient[];
  currentNumber: number;
  /** Locale for display text */
  locale?: "fr" | "ar";
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
  },
};

/**
 * TVQueueDisplay
 *
 * Full-screen TV display for clinic waiting rooms.
 * Shows current queue number and upcoming patients.
 * Designed for large screens (TV/monitor in waiting room).
 */
export function TVQueueDisplay({
  clinicName,
  patients,
  currentNumber,
  locale = "fr",
}: TVQueueDisplayProps) {
  const [time, setTime] = useState(new Date());
  const [flashCalled, setFlashCalled] = useState(false);
  const labels = LABELS[locale];
  const isRTL = locale === "ar";

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Flash effect when a patient is called
  const calledTicket = patients.find((p) => p.status === "called")?.ticketNumber;
  useEffect(() => {
    if (calledTicket != null) {
      const timer1 = setTimeout(() => setFlashCalled(true), 0);
      const timer2 = setTimeout(() => setFlashCalled(false), 3000);
      return () => { clearTimeout(timer1); clearTimeout(timer2); };
    }
  }, [calledTicket]);

  const inConsultation = patients.find((p) => p.status === "in-consultation");
  const calledPatient = patients.find((p) => p.status === "called");
  const waitingPatients = patients.filter((p) => p.status === "waiting");
  const nextFive = waitingPatients.slice(0, 5);

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white flex flex-col ${isRTL ? "rtl" : "ltr"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-black/20">
        <div className="flex items-center gap-4">
          <Stethoscope className="h-8 w-8 text-blue-300" />
          <h1 className="text-2xl font-bold">{clinicName}</h1>
        </div>
        <div className="text-right">
          <p className="text-3xl font-mono font-bold">
            {time.toLocaleTimeString(locale === "ar" ? "ar-MA" : "fr-MA", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="text-sm text-blue-200">
            {time.toLocaleDateString(locale === "ar" ? "ar-MA" : "fr-MA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
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

        {/* Right: Queue list */}
        <div className="w-96 flex flex-col">
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
                  <p className="text-lg">Pas de patients en attente</p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom stats */}
          <div className="mt-4 grid grid-cols-2 gap-3">
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
        </div>
      </div>

      {/* Footer ticker */}
      <div className="bg-black/30 px-8 py-3 text-center text-sm text-blue-200">
        {labels.pleaseWait} — {clinicName}
      </div>
    </div>
  );
}
