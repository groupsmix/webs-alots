"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette } from "@/components/command-palette";
import { usePatientSearch } from "@/lib/hooks/use-patient-search";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { useTenant } from "@/components/tenant-provider";

/**
 * Command-palette wrapper that searches patients by name, phone, or CIN
 * and navigates to the patient detail page on selection (Issue 37).
 *
 * Mount this in doctor/receptionist layouts — it binds Ctrl+K to open.
 */
export function PatientSearchPalette({ basePath = "/doctor/patients" }: { basePath?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const tenant = useTenant();

  const handleSelect = useCallback(
    (patientId: string) => {
      router.push(`${basePath}/${patientId}`);
    },
    [router, basePath],
  );

  const { items } = usePatientSearch(query, tenant?.clinicId, handleSelect);

  useKeyboardShortcuts([
    { key: "k", ctrl: true, handler: () => setOpen(true) },
  ]);

  return (
    <CommandPalette
      open={open}
      onClose={() => {
        setOpen(false);
        setQuery("");
      }}
      items={items}
      placeholder="Rechercher un patient (nom, tél, CIN)..."
      onQueryChange={setQuery}
    />
  );
}
