"use client";

import { Stethoscope, ClipboardList, User, Loader2, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_USERS } from "@/lib/demo";

const ROLE_CONFIG = [
  {
    key: "doctor" as const,
    label: "Docteur",
    description: "Gérez les rendez-vous, ordonnances et dossiers patients",
    icon: Stethoscope,
    color: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",
    dashboard: "/admin/dashboard",
  },
  {
    key: "receptionist" as const,
    label: "Réceptionniste",
    description: "Accueillez les patients, gérez l'agenda et les paiements",
    icon: ClipboardList,
    color: "bg-green-50 text-green-600 border-green-200 hover:bg-green-100",
    dashboard: "/admin/dashboard",
  },
  {
    key: "patient" as const,
    label: "Patient",
    description: "Prenez rendez-vous, consultez vos ordonnances et résultats",
    icon: User,
    color: "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100",
    dashboard: "/patient/dashboard",
  },
] as const;

export function DemoLoginCard() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDemoLogin(roleKey: "doctor" | "receptionist" | "patient") {
    setLoading(roleKey);
    setError(null);

    const user = DEMO_USERS[roleKey];
    const config = ROLE_CONFIG.find((r) => r.key === roleKey);

    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erreur de connexion démo");
        return;
      }

      // Redirect to the appropriate dashboard
      window.location.href = config?.dashboard ?? "/admin/dashboard";
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <Play className="h-7 w-7 text-amber-600" />
        </div>
        <CardTitle className="text-xl">Mode Démo</CardTitle>
        <CardDescription className="text-balance">
          Explorez Oltigo avec des données fictives.
          <br />
          Choisissez un rôle pour commencer.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {ROLE_CONFIG.map((role) => {
          const Icon = role.icon;
          const isLoading = loading === role.key;
          const demoUser = DEMO_USERS[role.key];

          return (
            <button
              key={role.key}
              type="button"
              onClick={() => handleDemoLogin(role.key)}
              disabled={loading !== null}
              className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors ${role.color} disabled:opacity-50`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{role.label}</span>
                  <span className="text-xs opacity-60">{demoUser.name}</span>
                </div>
                <p className="text-xs opacity-80 mt-0.5">{role.description}</p>
              </div>
            </button>
          );
        })}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="pt-2 text-center">
          <p className="text-xs text-muted-foreground">
            Les données sont fictives et réinitialisées régulièrement.
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <a href="/register-clinic" className="text-xs text-primary underline">
              Créer votre clinique
            </a>
            <span className="text-muted-foreground">•</span>
            <Link href="/" className="text-xs text-primary underline">
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
