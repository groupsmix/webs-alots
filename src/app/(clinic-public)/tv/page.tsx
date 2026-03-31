"use client";

import { useEffect, useState, useCallback } from "react";
import { TVQueueDisplay } from "@/components/morocco/tv-queue-display";
import { createClient } from "@/lib/supabase-client";

interface QueuePatient {
  id: string;
  ticketNumber: number;
  name: string;
  status: "waiting" | "called" | "in-consultation";
  estimatedWait: number;
  checkedInAt?: string;
}

interface ClinicInfo {
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  city?: string;
}

/**
 * Map appointment status to queue display status.
 */
function mapStatus(status: string): "waiting" | "called" | "in-consultation" | null {
  switch (status) {
    case "checked_in":
    case "confirmed":
      return "waiting";
    case "called":
      return "called";
    case "in_progress":
      return "in-consultation";
    default:
      return null;
  }
}

/**
 * Fetch today's queue from the appointments table.
 * Uses appointments with statuses that indicate the patient is present.
 */
async function fetchQueue(supabase: ReturnType<typeof createClient>): Promise<QueuePatient[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("appointments")
    .select("id, status, start_time, patient_id")
    .eq("appointment_date", today)
    .in("status", ["checked_in", "confirmed", "called", "in_progress"])
    .order("start_time", { ascending: true });

  if (!data) return [];

  // Collect patient IDs for name lookup
  const patientIds = [...new Set(data.map((a) => a.patient_id))];
  const nameMap = new Map<string, string>();

  if (patientIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", patientIds);

    if (users) {
      for (const u of users) {
        nameMap.set(u.id, u.name ?? "Patient");
      }
    }
  }

  const mapped: QueuePatient[] = [];
  let ticketCounter = 1;

  for (const entry of data) {
    const displayStatus = mapStatus(entry.status);
    if (!displayStatus) continue;

    mapped.push({
      id: entry.id,
      ticketNumber: ticketCounter++,
      name: nameMap.get(entry.patient_id) ?? "Patient",
      status: displayStatus,
      estimatedWait: 0,
      checkedInAt: entry.start_time ?? undefined,
    });
  }

  return mapped;
}

/**
 * /tv route — Waiting Room TV Display
 *
 * Accessible at: clinic.oltigo.com/tv
 *
 * This page provides a fullscreen waiting room display showing:
 * - Current queue status with ticket numbers
 * - Estimated wait times
 * - Prayer times for Morocco
 * - Rotating health tips in French/Darija
 *
 * The display auto-refreshes via Supabase Realtime subscriptions
 * and uses the Wake Lock API to prevent screen sleep.
 */
export default function TVPage() {
  const [patients, setPatients] = useState<QueuePatient[]>([]);
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo>({
    name: "Cabinet Médical",
  });
  const [currentNumber, setCurrentNumber] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to update currentNumber from patients list
  const updateCurrentNumber = useCallback((list: QueuePatient[]) => {
    const inConsultation = list.find((p) => p.status === "in-consultation");
    const called = list.find((p) => p.status === "called");
    setCurrentNumber(inConsultation?.ticketNumber ?? called?.ticketNumber ?? 0);
  }, []);

  // Fetch initial queue data and clinic settings
  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();

        // Fetch clinic info (branding) from the clinics table
        const { data: clinic } = await supabase
          .from("clinics")
          .select("name, logo_url, primary_color, city")
          .limit(1)
          .single();

        if (clinic) {
          setClinicInfo({
            name: clinic.name,
            logoUrl: clinic.logo_url ?? undefined,
            primaryColor: clinic.primary_color ?? undefined,
            city: clinic.city ?? undefined,
          });
        }

        // Fetch today's queue
        const queue = await fetchQueue(supabase);
        setPatients(queue);
        updateCurrentNumber(queue);
      } catch {
        // Silently handle errors — TV display should keep running
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [updateCurrentNumber]);

  // Supabase Realtime subscription handler
  const handleRealtimeSubscribe = useCallback(
    (callback: (patients: QueuePatient[]) => void) => {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];

      const channel = supabase
        .channel("tv-queue-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "appointments",
            filter: `appointment_date=eq.${today}`,
          },
          async () => {
            // Re-fetch the full queue on any change
            const queue = await fetchQueue(supabase);
            callback(queue);
            updateCurrentNumber(queue);
          },
        )
        .subscribe();

      // Also set up a 30-second polling fallback
      const pollInterval = setInterval(async () => {
        const queue = await fetchQueue(supabase);
        callback(queue);
        updateCurrentNumber(queue);
      }, 30000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollInterval);
      };
    },
    [updateCurrentNumber],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/30 border-t-white mx-auto mb-4" />
          <p className="text-xl">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <TVQueueDisplay
      clinicName={clinicInfo.name}
      patients={patients}
      currentNumber={currentNumber}
      logoUrl={clinicInfo.logoUrl}
      primaryColor={clinicInfo.primaryColor}
      city={clinicInfo.city ?? "Casablanca"}
      avgConsultationMinutes={15}
      onRealtimeSubscribe={handleRealtimeSubscribe}
    />
  );
}
