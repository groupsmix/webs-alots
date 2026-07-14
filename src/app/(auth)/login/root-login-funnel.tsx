"use client";

import { ArrowRight, Building2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type TranslationKey } from "@/lib/i18n";
import { logger } from "@/lib/logger";

interface ResolvedClinic {
  subdomain: string;
  name: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Build the tenant login URL for a subdomain on the current root host. */
function tenantLoginUrl(subdomain: string): string {
  const { protocol, host } = window.location;
  return `${protocol}//${subdomain}.${host}/login`;
}

/**
 * Root-domain login funnel. Staff enter their email and are routed to their
 * clinic's login without needing to know the subdomain. When one email maps to
 * multiple clinics, a small picker is shown.
 */
export function RootLoginFunnel() {
  const [locale] = useLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [choices, setChoices] = useState<ResolvedClinic[] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setChoices(null);

    const trimmed = email.trim();
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setFieldError(t(locale, "auth.invalidEmail"));
      return;
    }
    setFieldError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/resolve-clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (res.status === 429) {
        setError(t(locale, "auth.rateLimitLogin" as TranslationKey));
        setLoading(false);
        return;
      }

      const json = (await res.json()) as {
        ok: boolean;
        data?: { clinics: ResolvedClinic[] };
      };

      const clinics = json.data?.clinics ?? [];

      if (clinics.length === 0) {
        setError(t(locale, "auth.funnelNoClinic" as TranslationKey));
        setLoading(false);
        return;
      }

      if (clinics.length === 1) {
        window.location.assign(tenantLoginUrl(clinics[0].subdomain));
        return;
      }

      setChoices(clinics);
      setLoading(false);
    } catch (err) {
      logger.warn("resolve-clinic request failed", { context: "login-funnel", error: err });
      setError(t(locale, "error.unexpected"));
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="shadow-lg border-0 sm:border">
        <CardHeader className="pb-4 text-center">
          <CardTitle className="text-2xl font-bold">{t(locale, "auth.login")}</CardTitle>
          <CardDescription className="text-sm">
            {t(locale, "auth.funnelDesc" as TranslationKey)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {choices ? (
            <div className="space-y-2">
              <p className="mb-2 text-sm text-muted-foreground">
                {t(locale, "auth.funnelChooseClinic" as TranslationKey)}
              </p>
              {choices.map((clinic) => (
                <button
                  key={clinic.subdomain}
                  type="button"
                  onClick={() => window.location.assign(tenantLoginUrl(clinic.subdomain))}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2.5">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{clinic.name}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="funnel-email">{t(locale, "auth.email")}</Label>
                <Input
                  id="funnel-email"
                  name="email"
                  type="email"
                  placeholder={t(locale, "auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldError) setFieldError(null);
                  }}
                  required
                  autoFocus
                  className={`h-11 text-base ${fieldError ? "border-destructive" : ""}`}
                  aria-invalid={!!fieldError}
                  aria-describedby={fieldError ? "funnel-email-error" : undefined}
                />
                {fieldError && (
                  <p id="funnel-email-error" className="text-xs text-destructive">
                    {fieldError}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t(locale, "auth.funnelSearching" as TranslationKey)}
                  </>
                ) : (
                  t(locale, "auth.funnelContinue" as TranslationKey)
                )}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {t(locale, "auth.noAccount")}{" "}
            <Link href="/register-clinic/" className="text-primary hover:underline font-medium">
              {t(locale, "auth.register")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
