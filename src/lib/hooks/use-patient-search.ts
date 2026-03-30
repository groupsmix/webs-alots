"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentUser, fetchPatients, type PatientView } from "@/lib/data/client";
import { logger } from "@/lib/logger";

/**
 * Hook that loads clinic patients on mount and exposes them for
 * the command palette. Results are cached in-memory so opening
 * the palette multiple times doesn't re-fetch.
 *
 * @returns patients – full patient list (loaded once on mount)
 */
export function usePatientSearch() {
  const [patients, setPatients] = useState<PatientView[]>([]);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (loadedRef.current) return;
    try {
      const user = await getCurrentUser();
      if (!user?.clinic_id) return;
      const data = await fetchPatients(user.clinic_id);
      setPatients(data);
      loadedRef.current = true;
    } catch (err) {
      logger.warn("Failed to load patients for command palette", {
        context: "usePatientSearch",
        error: err,
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return patients;
}
