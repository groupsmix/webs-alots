"use client";

import { useState, useEffect, useRef } from "react";
import type { CommandPaletteItem } from "@/components/command-palette";
import { CommandIcons } from "@/components/command-palette";
import { logger } from "@/lib/logger";
import { maskPhone, maskCIN } from "@/lib/mask";
import { createClient } from "@/lib/supabase-client";

/**
 * Hook that performs a debounced Supabase patient search and returns
 * results formatted as `CommandPaletteItem[]` for the command palette.
 *
 * Searches by name, phone, and CIN (Issue 37).
 */
export function usePatientSearch(
  query: string,
  clinicId: string | undefined,
  onSelect: (patientId: string) => void,
): { items: CommandPaletteItem[]; loading: boolean } {
  const [items, setItems] = useState<CommandPaletteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2 || !clinicId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    timerRef.current = setTimeout(async () => {
      try {
        const supabase = createClient();
        const pattern = `%${trimmed}%`;

        const { data, error } = await supabase
          .from("users")
          .select("id, name, phone, email, metadata")
          .eq("clinic_id", clinicId)
          .eq("role", "patient")
          .or(`name.ilike.${pattern},phone.ilike.${pattern}`)
          .order("name", { ascending: true })
          .limit(20);

        if (error) {
          logger.warn("Patient search failed", { context: "use-patient-search", error });
          setItems([]);
          setLoading(false);
          return;
        }

        const results: CommandPaletteItem[] = (data ?? []).map((p) => {
          const meta = (p.metadata ?? {}) as { cin?: string };
          const cin = meta.cin;
          return {
            id: p.id,
            label: p.name,
            description: p.phone ? maskPhone(p.phone) : undefined,
            badge: cin ? maskCIN(cin) : undefined,
            icon: CommandIcons.patient,
            onSelect: () => onSelect(p.id),
          };
        });

        setItems(results);
      } catch (err) {
        logger.warn("Patient search error", { context: "use-patient-search", error: err });
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, clinicId, onSelect]);

  return { items, loading };
}
