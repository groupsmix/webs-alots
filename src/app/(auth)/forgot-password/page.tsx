"use client";

import { ArrowLeft, Mail, Check, Lock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { OltigoWordmark } from "@/components/brand/oltigo-mark";
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
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator";
import { resetPassword } from "@/lib/auth";
import { validatePasswordNotPwned } from "@/lib/hibp";
import { t, type TranslationKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-client";
import { passwordPolicySchema } from "@/lib/validations/password-policy";

export default function ForgotPasswordPage() {
  const [locale] = useLocale();
  const searchParams = useSearchParams();
  const isResetMode = searchParams.get("mode") === "reset";

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // MEDIUM 3.1: Use server action instead of client-side Supabase client.
      // This ensures rate limiting and logging are applied server-side.
      const result = await resetPassword(
        email,
        `${window.location.origin}/auth/callback?type=recovery`,
      );

      if (result.error) {
        setError(t(locale, result.error as TranslationKey));
        setLoading(false);
        return;
      }

      // HIGH 2.4: Always show generic success message regardless of
      // whether the email exists, preventing username enumeration.
      setSent(true);
      setLoading(false);
    } catch {
      setError(t(locale, "error.unexpected"));
      setLoading(false);
    }
  }

  async function handleSetNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const policyResult = passwordPolicySchema.safeParse(newPassword);
    if (!policyResult.success) {
      setError(policyResult.error.issues[0].message);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // 6e / A154: HIBP k-anonymity check — only the first 5 chars of the
      // SHA-1 hash are sent to the API; the plaintext password never leaves
      // this device. Fail-open on network error so users can still reset
      // during HIBP outages. See src/lib/hibp.ts.
      const hibpError = await validatePasswordNotPwned(newPassword);
      if (hibpError) {
        setError(hibpError);
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setResetComplete(true);
      setLoading(false);
    } catch {
      setError(t(locale, "error.unexpected"));
      setLoading(false);
    }
  }

  if (isResetMode) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="mb-8 text-center">
          <OltigoWordmark size="lg" className="justify-center" />
          <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
            {t(locale, "auth.portalTitle")}
          </p>
        </div>

        <Card>
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              {resetComplete ? (
                <Check className="h-6 w-6 text-primary" />
              ) : (
                <Lock className="h-6 w-6 text-primary" />
              )}
            </div>
            <CardTitle className="text-xl">
              {resetComplete ? t(locale, "forgot.emailSent" as TranslationKey) : "Set New Password"}
            </CardTitle>
            <CardDescription>
              {resetComplete
                ? "Your password has been updated. You can now sign in."
                : "Enter your new password below."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {!resetComplete ? (
              <form className="space-y-4" onSubmit={handleSetNewPassword}>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">
                    {t(locale, "auth.password" as TranslationKey)}
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="text-base"
                  />
                  <PasswordStrengthIndicator password={newPassword} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">
                    {t(locale, "auth.password" as TranslationKey)}
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="text-base"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors w-full"
              >
                {t(locale, "auth.signIn")}
              </Link>
            )}
          </CardContent>
          <CardFooter className="justify-center border-t pt-4">
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-primary hover:underline font-medium"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t(locale, "forgot.backToLogin")}
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8 text-center">
        <OltigoWordmark size="lg" className="justify-center" />
        <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
          {t(locale, "auth.portalTitle")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t(locale, "forgot.resetSubtitle")}</p>
      </div>

      <Card>
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {sent ? (
              <Check className="h-6 w-6 text-primary" />
            ) : (
              <Mail className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle className="text-xl">
            {sent ? t(locale, "forgot.emailSent") : t(locale, "forgot.title")}
          </CardTitle>
          <CardDescription>
            {sent ? `${t(locale, "forgot.emailSentDesc")} ${email}` : t(locale, "forgot.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!sent && (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">{t(locale, "auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t(locale, "auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-base"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t(locale, "forgot.sending") : t(locale, "forgot.sendLink")}
              </Button>
            </form>
          )}

          {sent && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              {t(locale, "forgot.sendToAnother")}
            </Button>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t pt-4">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-primary hover:underline font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t(locale, "forgot.backToLogin")}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
