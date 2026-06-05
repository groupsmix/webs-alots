/* eslint-disable i18next/no-literal-string */
"use client";

import { Globe, Loader2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface CustomDomainFormProps {
  clinicId: string;
  currentDomain: string | null;
  status: string | null;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;

  if (status === "verified") {
    return <Badge variant="success">Vérifié</Badge>;
  }
  if (status === "error") {
    return <Badge variant="destructive">Erreur</Badge>;
  }
  // pending or any other value
  return (
    <Badge variant="outline" className="border-amber-500 text-amber-600">
      En attente
    </Badge>
  );
}

export function CustomDomainForm({ clinicId, currentDomain, status }: CustomDomainFormProps) {
  const [domain, setDomain] = useState(currentDomain ?? "");
  const [currentStatus, setCurrentStatus] = useState<string | null>(status);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  async function handleVerify() {
    const trimmed = domain.trim();
    if (!trimmed) {
      addToast("Veuillez saisir un domaine.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/clinics/${clinicId}/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: trimmed }),
      });

      const json = (await res.json()) as { ok: boolean; error?: string; code?: string };

      if (!res.ok || !json.ok) {
        const msg =
          json.code === "CNAME_MISMATCH"
            ? "CNAME ne pointe pas vers clinics.oltigo.com. Vérifiez votre configuration DNS."
            : (json.error ?? "Échec de la vérification du domaine.");
        setCurrentStatus("error");
        addToast(msg, "error");
        return;
      }

      setCurrentStatus("verified");
      addToast("Domaine vérifié avec succès !", "success");
    } catch {
      setCurrentStatus("error");
      addToast("Erreur réseau. Veuillez réessayer.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Domain input */}
      <div className="space-y-2">
        <label htmlFor="custom-domain" className="text-sm font-medium">
          Domaine personnalisé
        </label>
        <div className="flex gap-2">
          <Input
            id="custom-domain"
            type="text"
            placeholder="clinic.example.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={loading}
            className="flex-1"
          />
          {currentStatus && <StatusBadge status={currentStatus} />}
        </div>
      </div>

      {/* DNS instructions */}
      <Card className="bg-muted/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Instructions DNS
          </CardTitle>
          <CardDescription className="text-xs">
            Ajoutez l&apos;enregistrement suivant chez votre registraire de domaine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-background border px-4 py-3 text-sm font-mono">
            <span className="text-muted-foreground">CNAME</span>{" "}
            <span className="font-semibold">votre-clinique</span>{" "}
            <span className="text-muted-foreground">→</span>{" "}
            <span className="font-semibold text-primary">clinics.oltigo.com</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            La propagation DNS peut prendre jusqu&apos;à 48 heures.
          </p>
        </CardContent>
      </Card>

      {/* Verify button */}
      <Button onClick={handleVerify} disabled={loading} className="w-full sm:w-auto">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Vérification…
          </>
        ) : (
          "Vérifier le CNAME"
        )}
      </Button>
    </div>
  );
}
