"use client";

import { ShieldCheck, ArrowLeft, Key, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase-client";

/**
 * /mfa-verify — AAL2 step-up page.
 *
 * Reached from `mfa-enforcement.ts` when a super_admin / clinic_admin has a
 * verified TOTP factor enrolled but the current session is at AAL1 (factor
 * not yet challenged this session). After a successful TOTP challenge the
 * session is elevated to AAL2 and the user is redirected to `?next`.
 *
 * This page intentionally does NOT expose the enrolment QR code — it is a
 * step-up challenge only. Users without an authenticator enrolled are sent to
 * /setup-2fa first by mfa-enforcement.ts.
 */

function MfaVerifyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/super-admin/dashboard";

  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useBackup, setUseBackup] = useState(false);
  const [backupCode, setBackupCode] = useState("");

  // Fetch the user's first verified TOTP factor on mount.
  useEffect(() => {
    async function loadFactor() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.mfa.listFactors();
        const verified = (data?.totp ?? []).find((f) => f.status === "verified");
        if (verified) {
          setFactorId(verified.id);
        } else {
          // No verified factor — shouldn't happen (middleware guards this),
          // but redirect to setup as a safe fallback.
          router.replace(`/setup-2fa?required=1&next=${encodeURIComponent(next)}`);
        }
      } catch {
        setError("Impossible de charger les données d'authentification. Veuillez réessayer.");
      } finally {
        setLoadingFactors(false);
      }
    }
    loadFactor();
  }, [next, router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        setError("Impossible de démarrer le défi MFA. Veuillez réessayer.");
        setLoading(false);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: code.trim(),
      });

      if (verifyError) {
        setError("Code incorrect. Vérifiez votre application d'authentification et réessayez.");
        setLoading(false);
        return;
      }

      // AAL2 reached — proceed to destination.
      router.replace(next);
    } catch {
      setError("Une erreur inattendue s'est produite. Veuillez réessayer.");
      setLoading(false);
    }
  }

  async function handleBackupVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { verifyBackupCode } = await import("@/lib/mfa");
      const result = await verifyBackupCode(backupCode.trim());
      if (result.error) {
        setError("Code de secours invalide. Vérifiez la casse et réessayez.");
        setLoading(false);
        return;
      }
      router.replace(next);
    } catch {
      setError("Une erreur inattendue s'est produite. Veuillez réessayer.");
      setLoading(false);
    }
  }

  if (loadingFactors) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Chargement…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-xl font-bold">Vérification en deux étapes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Votre rôle requiert une authentification renforcée pour continuer.
        </p>
      </div>

      <Card>
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-lg">
            {useBackup ? "Code de secours" : "Code d'authentification"}
          </CardTitle>
          <CardDescription>
            {useBackup
              ? "Saisissez l'un de vos codes de secours à usage unique."
              : "Ouvrez votre application d'authentification et saisissez le code à 6 chiffres."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!useBackup ? (
            <form className="space-y-4" onSubmit={handleVerify}>
              <div className="space-y-2">
                <Label htmlFor="totp-code">Code TOTP</Label>
                <Input
                  id="totp-code"
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Vérifier
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  onClick={() => {
                    setUseBackup(true);
                    setError(null);
                    setCode("");
                  }}
                >
                  <Key className="h-3 w-3" />
                  Utiliser un code de secours
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleBackupVerify}>
              <div className="space-y-2">
                <Label htmlFor="backup-code">Code de secours</Label>
                <Input
                  id="backup-code"
                  placeholder="XXXX-XXXX"
                  maxLength={9}
                  className="text-center text-xl tracking-widest font-mono uppercase"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || backupCode.length < 8}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Vérifier le code de secours
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setUseBackup(false);
                  setError(null);
                  setBackupCode("");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Utiliser mon application 2FA
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2 border-t pt-4">
          <p className="text-xs text-muted-foreground text-center">
            Authentification à deux facteurs obligatoire pour les rôles Super Admin et Admin
            Clinique.
          </p>
          <Button
            variant="link"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => router.push("/login")}
          >
            Se connecter avec un autre compte
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function MfaVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md mx-auto flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MfaVerifyInner />
    </Suspense>
  );
}
