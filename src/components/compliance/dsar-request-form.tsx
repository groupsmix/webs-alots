"use client";
/* eslint-disable i18next/no-literal-string -- Internal/super-admin-only surface or English-first form. The FR/AR translation backlog will catch up; do not add these strings to the i18n keyset now. */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const REQUEST_TYPES = [
  { value: "access", label: "Accès" },
  { value: "rectification", label: "Rectification" },
  { value: "deletion", label: "Suppression" },
  { value: "portability", label: "Portabilité" },
  { value: "objection", label: "Opposition" },
] as const;

export function DSARRequestForm() {
  const [requestType, setRequestType] = useState("access");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        requesterName: String(formData.get("requesterName") ?? ""),
        requesterEmail: String(formData.get("requesterEmail") ?? ""),
        requesterPhone: String(formData.get("requesterPhone") ?? ""),
        clinicName: String(formData.get("clinicName") ?? ""),
        requestType,
        description: String(formData.get("description") ?? ""),
      };

      const response = await fetch("/api/compliance/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as
        | { ok?: boolean; dsarNumber?: number; error?: string }
        | { data?: { dsarNumber?: number }; error?: string };

      if (!response.ok) {
        setError("Impossible d'envoyer votre demande pour le moment.");
        return;
      }

      const dsarNumber = "data" in json ? json.data?.dsarNumber : json.dsarNumber;
      setResult(
        dsarNumber
          ? `Votre demande a été enregistrée sous le numéro #${dsarNumber}.`
          : "Votre demande a été enregistrée.",
      );
    } catch {
      setError("Impossible d'envoyer votre demande pour le moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Formulaire DSAR</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={(formData) => {
            void onSubmit(formData);
          }}
          className="space-y-4"
        >
          <Input name="requesterName" placeholder="Nom complet" required minLength={2} />
          <Input name="requesterEmail" type="email" placeholder="Email" required />
          <Input name="requesterPhone" placeholder="Téléphone (+212...)" />
          <Input name="clinicName" placeholder="Nom de la clinique concernée (optionnel)" />

          <Select value={requestType} onValueChange={setRequestType}>
            <SelectTrigger>
              <SelectValue
                placeholder="Choisir le type de demande"
                value={REQUEST_TYPES.find((t) => t.value === requestType)?.label}
              />
            </SelectTrigger>
            <SelectContent>
              {REQUEST_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            name="description"
            placeholder="Décrivez précisément votre demande et les données concernées."
            required
            minLength={20}
            className="min-h-32"
          />

          {result ? <p className="text-sm text-green-600">{result}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Envoi..." : "Envoyer la demande"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
