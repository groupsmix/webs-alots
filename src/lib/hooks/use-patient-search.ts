"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { getCurrentUser, fetchPatients, type PatientView } from "@/lib/data/client";
import type { CommandPaletteItem } from "@/components/command-palette";

/**
 * Debounced patient search hook that returns CommandPaletteItem[].
 * Fetches all patients once on mount, then filters client-side by
 * name, phone, or insurance (used as CIN proxy).
 */
export function usePatientSearch(query: string, debounceMs = 300) {
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load patients once
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted || !user?.clinic_id) return;
      const pts = await fetchPatients(user.clinic_id);
      if (!controller.signal.aborted) setPatients(pts);
    }
    load().catch(() => {});
    return () => { controller.abort(); };
  }, []);

  // Debounce the query
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs]);

  // Derive results from debounced query
  const results: CommandPaletteItem[] = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return [];

    const filtered = patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        (p.insurance && p.insurance.toLowerCase().includes(q))
    );

    return filtered.slice(0, 20).map((p) => ({
      id: p.id,
      label: p.name,
      description: p.phone,
      badge: p.insurance || undefined,
      onSelect: () => {},
    }));
  }, [debouncedQuery, patients]);

  const loading = query !== debouncedQuery;

  return { results, loading };
}
