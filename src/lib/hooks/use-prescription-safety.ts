/**
 * usePrescriptionSafety — React hook for real-time prescription safety checks.
 *
 * Debounces calls to POST /api/v1/ai/prescription-safety to avoid
 * flooding the API on every keystroke when building a prescription.
 *
 * OWASP A03: Medication names trimmed and bounded before sending.
 */
"use client";

import { useCallback, useRef, useState } from "react";

// ── Types ──

export interface PrescriptionItem {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
}

export interface PatientHistory {
  age?: number;
  weight?: number;
  conditions: string[];
  allergies: string[];
  pregnancy?: boolean;
  renalImpairment?: boolean;
  hepaticImpairment?: boolean;
}

export interface SafetyFlag {
  severity: "critical" | "major" | "moderate" | "minor";
  type: "interaction" | "contraindication" | "dosing" | "allergy" | "pregnancy";
  drugs: string[];
  message: string;
  recommendation: string;
}

export interface SafetyResult {
  flags: SafetyFlag[];
  overallRisk: "safe" | "caution" | "warning" | "danger";
  summary: string;
  disclaimer?: string;
  cached?: boolean;
}

export interface UsePrescriptionSafetyOptions {
  patientId: string;
  existingMedications?: string[];
  patientHistory?: PatientHistory;
  debounceMs?: number;
}

export interface UsePrescriptionSafetyReturn {
  result: SafetyResult | null;
  isChecking: boolean;
  error: string | null;
  checkSafety: (prescriptions: PrescriptionItem[]) => void;
  clearResult: () => void;
}

// ── Hook ──

export function usePrescriptionSafety(
  options: UsePrescriptionSafetyOptions,
): UsePrescriptionSafetyReturn {
  const { patientId, existingMedications = [], patientHistory, debounceMs = 1500 } = options;

  const [result, setResult] = useState<SafetyResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const checkSafety = useCallback(
    (prescriptions: PrescriptionItem[]) => {
      // Cancel any pending debounce
      if (timerRef.current) clearTimeout(timerRef.current);

      // Skip if no patient or no prescriptions
      if (!patientId || prescriptions.length === 0) {
        setResult(null);
        return;
      }

      timerRef.current = setTimeout(async () => {
        // Abort any in-flight request
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setIsChecking(true);
        setError(null);

        try {
          // OWASP A03: Bound medication name length before sending
          const sanitizedPrescriptions = prescriptions.map((p) => ({
            name: p.name.trim().slice(0, 200),
            dosage: p.dosage?.trim().slice(0, 100),
            frequency: p.frequency?.trim().slice(0, 100),
            duration: p.duration?.trim().slice(0, 100),
          }));

          const response = await fetch("/api/v1/ai/prescription-safety", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              currentPrescriptions: sanitizedPrescriptions,
              patientId,
              existingMedications: existingMedications.map((m) => m.trim().slice(0, 200)),
              patientHistory: patientHistory ?? {},
            }),
            signal: controller.signal,
          });

          const data = (await response.json()) as {
            ok: boolean;
            data?: SafetyResult;
            error?: string;
          };

          if (!data.ok) {
            setError(data.error ?? "Erreur lors de la vérification de sécurité.");
            return;
          }

          if (data.data) {
            setResult(data.data);
          }
        } catch (err) {
          // Ignore abort errors (expected when request is cancelled)
          if (err instanceof Error && err.name === "AbortError") return;
          setError("Vérification non disponible. Veuillez vérifier manuellement.");
        } finally {
          setIsChecking(false);
        }
      }, debounceMs);
    },
    [patientId, existingMedications, patientHistory, debounceMs],
  );

  const clearResult = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    setResult(null);
    setError(null);
    setIsChecking(false);
  }, []);

  return { result, isChecking, error, checkSafety, clearResult };
}
