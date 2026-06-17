"use client";

import { UserPlus, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/data/client";
import { isMinorByDob, MINOR_AGE_THRESHOLD } from "@/lib/minors";
import type { TablesInsert } from "@/lib/types/database";

interface QuickPatientRegistrationProps {
  clinicId: string;
  onRegistered?: (patient: { id: string; name: string; phone: string }) => void;
}

export function QuickPatientRegistration({
  clinicId,
  onRegistered,
}: QuickPatientRegistrationProps) {
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
      const supabase = createClient();

      // Check if patient already exists with this phone number
      const { data: existing } = await supabase
        .from("users")
        .select("id, name, phone")
        .eq("phone", phone.trim())
        .eq("clinic_id", clinicId)
        .eq("role", "patient")
        .limit(1)
        .single();

      if (existing) {
        onRegistered?.({ id: existing.id, name: existing.name, phone: existing.phone ?? "" });
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setName("");
          setPhone("");
          setDateOfBirth("");
        }, 2000);
        setSubmitting(false);
        return;
      }

      // Create new patient. date_of_birth is a real users column but is not in
      // the curated DB types, so build a loose payload and cast (same pattern as
      // the /api/v1/patients route).
      const insertPayload: Record<string, unknown> = {
        name: name.trim(),
        phone: phone.trim(),
        date_of_birth: dateOfBirth || null,
        clinic_id: clinicId,
        role: "patient",
      };
      const { data: newPatient, error: insertError } = await supabase
        .from("users")
        .insert(insertPayload as TablesInsert<"users">)
        .select("id, name, phone")
        .single();

      if (insertError) {
        setError("Failed to register patient. Please try again.");
        setSubmitting(false);
        return;
      }

      if (newPatient) {
        onRegistered?.({ id: newPatient.id, name: newPatient.name, phone: newPatient.phone ?? "" });
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setName("");
          setPhone("");
          setDateOfBirth("");
        }, 2000);
      }
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
                <Check className="h-4 w-4 mr-1" />
                Registered!
              </>
            ) : submitting ? (
              "Registering..."
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-1" />
                Register (5s)
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
