"use client";

import { UserPlus, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isMinorByDob, MINOR_AGE_THRESHOLD } from "@/lib/minors";

interface QuickPatientRegistrationProps {
  /**
   * Kept for call-site gating (the dashboard only renders this once a clinic
   * context exists); the create request derives the clinic from the session.
   */
  clinicId?: string;
  onRegistered?: (patient: { id: string; name: string; phone: string }) => void;
}

export function QuickPatientRegistration({ onRegistered }: QuickPatientRegistrationProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    // Adult-only gating (A200): block registration of minors until a
    // parental-consent flow exists. DOB is optional; when given and under age,
    // reject with a clear message.
    if (dateOfBirth && isMinorByDob(dateOfBirth)) {
      setError(
        `Patient must be at least ${MINOR_AGE_THRESHOLD}. Registering minors is not supported yet (parental consent required — Loi 09-08 / RGPD Art. 8).`,
      );
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Front-desk patient creation goes through an authenticated API route:
      // direct client inserts into `users` are rejected by RLS
      // (`users_insert_self_only`) for staff-created, auth-less patients.
      const res = await fetch("/api/receptionist/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          dateOfBirth: dateOfBirth || undefined,
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        data?: { patient?: { id: string; name: string; phone: string } };
        error?: string;
      } | null;

      if (!res.ok || !json?.data?.patient) {
        setError(json?.error ?? "Failed to register patient. Please try again.");
        setSubmitting(false);
        return;
      }

      const patient = json.data.patient;
      onRegistered?.({ id: patient.id, name: patient.name, phone: patient.phone });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setName("");
        setPhone("");
        setDateOfBirth("");
      }, 2000);
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Quick Patient Registration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-2">
          <Input
            placeholder="Patient name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
          <Input
            placeholder="+212 6XX XX XX XX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={submitting}
          />
          <Input
            type="date"
            aria-label="Date of birth"
            value={dateOfBirth}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDateOfBirth(e.target.value)}
            disabled={submitting}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button
            type="submit"
            size="sm"
            className="w-full"
            disabled={!name.trim() || !phone.trim() || submitting}
          >
            {success ? (
              <>
                <Check className="h-4 w-4 me-1" />
                Registered!
              </>
            ) : submitting ? (
              "Registering..."
            ) : (
              <>
                <UserPlus className="h-4 w-4 me-1" />
                Register (5s)
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
