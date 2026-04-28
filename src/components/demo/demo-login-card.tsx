/* eslint-disable i18next/no-literal-string -- Demo UI with intentional French strings */
"use client";

import { User, Loader2, Play } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_USERS } from "@/lib/demo";

/**
 * R-10: Only the patient role is exposed for demo login.
 * Elevated roles (doctor, receptionist, clinic_admin, super_admin) are refused
 * server-side and no longer presented in the UI.
 */
const PATIENT_DEMO = {
  key: "patient" as const,
  label: "Patient",
  description: "Prenez rendez-vous, consultez vos ordonnances et résultats",
  icon: User,
  color: "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100",
  dashboard: "/patient/dashboard",
} as const;

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        "error-callback"?: () => void;
        "expired-callback"?: () => void;
      }) => string;
      reset: (widgetId: string) => void;
    };
  }
}

export function DemoLoginCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const turnstileToken = useRef<string | null>(null);
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // R-10 Fix: Load Turnstile script dynamically
  useEffect(() => {
    if (!siteKey) return;

    // Check if already loaded
    if (window.turnstile) {
      setScriptLoaded(true);
      return;
    }

    // Load the Turnstile script
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.body.appendChild(script);

    return () => {
      // Cleanup is not needed for global script
    };
  }, [siteKey]);

  // R-10 Fix: Render Turnstile widget after script loads
  useEffect(() => {
    if (!siteKey || !turnstileContainer.current || !window.turnstile || !scriptLoaded) return;

    // Avoid re-rendering if already rendered
    if (widgetId.current) return;

    widgetId.current = window.turnstile.render(turnstileContainer.current, {
      sitekey: siteKey,
      callback: (token: string) => { turnstileToken.current = token; },
      "error-callback": () => { turnstileToken.current = null; },
      "expired-callback": () => { turnstileToken.current = null; },
    });
  }, [siteKey, scriptLoaded]);

  async function handleDemoLogin() {
    setLoading(true);
    setError(null);

    const user = DEMO_USERS.patient;

    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          ...(turnstileToken.current ? { turnstile_token: turnstileToken.current } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erreur de connexion démo");
        if (widgetId.current && window.turnstile) {
          window.turnstile.reset(widgetId.current);
          turnstileToken.current = null;
        }
        return;
      }

      window.location.href = PATIENT_DEMO.dashboard;
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  const Icon = PATIENT_DEMO.icon;

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
          Connectez-vous en tant que patient pour commencer.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <button
          type="button"
          onClick={() => handleDemoLogin()}
          disabled={loading}
          className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors ${PATIENT_DEMO.color} disabled:opacity-50`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Icon className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{PATIENT_DEMO.label}</span>
              <span className="text-xs opacity-60">{DEMO_USERS.patient.name}</span>
            </div>
            <p className="text-xs opacity-80 mt-0.5">{PATIENT_DEMO.description}</p>
          </div>
        </button>

        {siteKey && <div ref={turnstileContainer} />}

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
