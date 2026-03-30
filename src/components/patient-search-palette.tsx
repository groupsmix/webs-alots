"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { CommandPalette, type CommandPaletteItem } from "@/components/command-palette";
import { usePatientSearch } from "@/lib/hooks/use-patient-search";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";

/**
 * Patient search palette — wraps CommandPalette with live patient data.
 * Opens with Ctrl+K. Selecting a patient navigates to their detail page.
 */
export function PatientSearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { results } = usePatientSearch(query);

  useKeyboardShortcuts([
    { key: "k", ctrl: true, handler: () => setOpen(true), description: "Open patient search" },
  ]);

  const items: CommandPaletteItem[] = results.map((r) => ({
    ...r,
    icon: <User className="h-4 w-4" />,
    onSelect: () => {
      router.push(`/doctor/patients`);
      setOpen(false);
    },
  }));

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  return (
    <CommandPalette
      open={open}
      onClose={handleClose}
      items={items}
    />
  );
}
