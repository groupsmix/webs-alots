"use client";

import { useEffect, useCallback } from "react";

const STORAGE_KEY = "booking-progress";
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

interface BookingProgress {
  step: number;
  selectedDoctor: string;
  selectedService: string;
  selectedDate: string;
  selectedTime: string;
  patientPhone: string;
  patientName: string;
  savedAt: number;
}

/**
 * Persist and restore booking form progress using localStorage.
 * Saved data expires after 30 minutes to avoid stale state.
 */
export function useBookingPersistence() {
  const save = useCallback((data: Omit<BookingProgress, "savedAt">) => {
    try {
      const entry: BookingProgress = { ...data, savedAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    } catch {
      // Storage unavailable or full; silently ignore
    }
  }, []);

  const load = useCallback((): Omit<BookingProgress, "savedAt"> | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const entry: BookingProgress = JSON.parse(raw);
      if (Date.now() - entry.savedAt > EXPIRY_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      const { savedAt: _, ...data } = entry;
      return data;
    } catch {
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Clear on unmount if completed (consumer calls clear())
  useEffect(() => {
    return () => {
      // Cleanup handled by consumer
    };
  }, []);

  return { save, load, clear };
}
