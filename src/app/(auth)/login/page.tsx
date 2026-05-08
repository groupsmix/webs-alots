"use client";

import { Phone, ShieldCheck, ArrowLeft, Heart, Mail, Lock, Key } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
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
import { signInWithOTP, verifyOTP, signInWithPassword } from "@/lib/auth";
import { t, type TranslationKey } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-client";
const PHONE_AUTH_ENABLED = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true";

export default function LoginPage() {
  const [locale] = useLocale();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [step, setStep] = useState<"credentials" | "otp" | "mfa" | "backup">("credentials");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  // MEDIUM 3.4: OTP resend cooldown (60 seconds)
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  const startOtpCooldown = useCallback(() => {
    setOtpCooldown(60);
  }, []);
  function validateEmailForm(): boolean {
    const errors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = t(locale, "auth.invalidEmail");
    }
    if (password.length < 6) {
      errors.password = t(locale, "auth.passwordTooShort");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!validateEmailForm()) return;

    setLoading(true);

    try {
      const result = await signInWithPassword(email.trim(), password);
      if (result.error) {
        // Check if MFA is required after successful password auth
        if (result.error === "mfa_required") {
          const supabase = createClient();
          const { data: factorsData } = await supabase.auth.mfa.listFactors();
          const totpFactor = factorsData?.totp?.find((f) => f.status === "verified");
          if (totpFactor) {
            setMfaFactorId(totpFactor.id);
            setStep("mfa");
            setLoading(false);
            return;
          }
        }
        // HIGH 2.4: Normalize all login error messages to a single generic
        // message to prevent username enumeration. Supabase returns different
        // messages for valid vs. invalid accounts which could leak information.
        // Rate-limit messages are passed through since they don't leak user info.
        const rateLimitKeys = ["auth.rateLimitLogin", "auth.accountLocked"];
        const isRateLimitError = rateLimitKeys.includes(result.error);
        setError(
          isRateLimitError
            ? t(locale, result.error as TranslationKey)
            : t(locale, "auth.invalidCredentials"),
        );
        setLoading(false);
      }
    } catch (err) {
      logger.warn("Email login failed", { context: "login", error: err });
      setError(t(locale, "error.unexpected"));
      setLoading(false);
    }
  }

  async function handleSendOTP(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);

    setLoading(true);

    try {
      const result = await signInWithOTP(phone);

      if (result.error) {
        setError(t(locale, result.error as TranslationKey));
        setLoading(false);
        return;
      }

      setStep("otp");
      startOtpCooldown();
      setLoading(false);
    } catch (err) {
      logger.warn("OTP send failed", { context: "login", error: err });
      setError(t(locale, "error.unexpected"));
      setLoading(false);
    }
  }

  async function handleMFAVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId) return;
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: mfaFactorId });

      if (challengeError) {
        setError(t(locale, "auth.mfaVerifyError" as TranslationKey));
        setLoading(false);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode,
      });

      if (verifyError) {
        setError(t(locale, "auth.mfaInvalidCode" as TranslationKey));
        setLoading(false);
        return;
      }

      // MFA verified — redirect will happen via auth state change
      window.location.href = "/doctor/dashboard";
    } catch (err) {
      logger.warn("MFA verification failed", { context: "login", error: err });
      setError(t(locale, "error.unexpected"));
      setLoading(false);
    }
  }

  async function handleBackupCodeVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { verifyBackupCode } = await import("@/lib/mfa");
      const result = await verifyBackupCode(backupCode);
      if (result.error) {
        setError(t(locale, "auth.mfaInvalidBackupCode" as TranslationKey));
        setLoading(false);
        return;
      }

      // Backup code verified — redirect
      window.location.href = "/doctor/dashboard";
    } catch (err) {
      logger.warn("Backup code verification failed", { context: "login", error: err });
      setError(t(locale, "error.unexpected"));
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await verifyOTP(phone, otp);
      if (result.error) {
        setError(t(locale, result.error as TranslationKey));
        setLoading(false);
      }
    } catch (err) {
      logger.warn("OTP verification failed", { context: "login", error: err });
      setError(t(locale, "error.unexpected"));
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Heart className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-xl font-bold">{t(locale, "auth.portalTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t(locale, "auth.loginSubtitle")}</p>
      </div>

      <Card>
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {step === "otp" || step === "mfa" || step === "backup" ? (
              <ShieldCheck className="h-6 w-6 text-primary" />
            ) : method === "email" ? (
              <Mail className="h-6 w-6 text-primary" />
            ) : (
              <Phone className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle className="text-xl">
            {step === "otp"
              ? t(locale, "auth.verifyNumber")
              : step === "mfa"
                ? t(locale, "auth.mfaTitle" as TranslationKey)
                : step === "backup"
                  ? t(locale, "auth.mfaBackupTitle" as TranslationKey)
                  : t(locale, "auth.login")}
          </CardTitle>
          <CardDescription>
            {step === "otp"
              ? `${t(locale, "auth.otpSent")} ${phone}`
              : step === "mfa"
                ? t(locale, "auth.mfaDesc" as TranslationKey)
                : step === "backup"
                  ? t(locale, "auth.mfaBackupDesc" as TranslationKey)
                  : method === "email"
                    ? t(locale, "auth.emailLoginDesc")
                    : t(locale, "auth.phoneLoginDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* MFA TOTP Verification Step */}
          {step === "mfa" ? (
            <form className="space-y-4" onSubmit={handleMFAVerify}>
              <div className="space-y-2">
                <Label htmlFor="mfa-code">{t(locale, "auth.mfaCodeLabel" as TranslationKey)}</Label>
                <Input
                  id="mfa-code"
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || mfaCode.length !== 6}>
                {loading ? t(locale, "auth.verifying") : t(locale, "auth.mfaVerifyButton" as TranslationKey)}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  onClick={() => {
                    setStep("backup");
                    setError(null);
                    setMfaCode("");
                  }}
                >
                  <Key className="h-3 w-3" />
                  {t(locale, "auth.mfaUseBackupCode" as TranslationKey)}
                </button>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("credentials");
                  setMfaCode("");
                  setError(null);
                  setMfaFactorId(null);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t(locale, "action.back")}
              </Button>
            </form>
          ) : step === "backup" ? (
            /* Backup Code Verification Step */
            <form className="space-y-4" onSubmit={handleBackupCodeVerify}>
              <div className="space-y-2">
                <Label htmlFor="backup-code">{t(locale, "auth.mfaBackupCodeLabel" as TranslationKey)}</Label>
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
                {loading ? t(locale, "auth.verifying") : t(locale, "auth.mfaVerifyButton" as TranslationKey)}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("mfa");
                  setBackupCode("");
                  setError(null);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t(locale, "auth.mfaUseTOTP" as TranslationKey)}
              </Button>
            </form>
          ) : step === "otp" && PHONE_AUTH_ENABLED ? (
            <form className="space-y-4" onSubmit={handleVerifyOTP}>
              <div className="space-y-2">
                <Label htmlFor="otp">{t(locale, "auth.otpLabel")}</Label>
                <Input
                  id="otp"
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">
                  {t(locale, "auth.otpNotReceived")}{" "}
                  <button
                    type="button"
                    className={`text-primary hover:underline ${otpCooldown > 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={() => handleSendOTP()}
                    disabled={otpCooldown > 0}
                  >
                    {otpCooldown > 0 ? `${t(locale, "auth.resendCountdown")} (${otpCooldown}s)` : t(locale, "auth.resend")}
                  </button>
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t(locale, "auth.verifying") : t(locale, "auth.verifyAndLogin")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("credentials");
                  setOtp("");
                  setError(null);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t(locale, "auth.useAnotherNumber")}
              </Button>
            </form>
          ) : method === "email" ? (
            <form className="space-y-4" onSubmit={handleEmailLogin}>
              <div className="space-y-2">
                <Label htmlFor="email">{t(locale, "auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t(locale, "auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  required
                  className={`text-base ${fieldErrors.email ? "border-destructive" : ""}`}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                />
                {fieldErrors.email && (
                  <p id="email-error" className="text-xs text-destructive">{fieldErrors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t(locale, "auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t(locale, "auth.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  required
                  className={`text-base ${fieldErrors.password ? "border-destructive" : ""}`}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                />
                {fieldErrors.password && (
                  <p id="password-error" className="text-xs text-destructive">{fieldErrors.password}</p>
                )}
              </div>
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  {t(locale, "auth.forgotPassword")}
                </Link>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t(locale, "auth.signingIn") : t(locale, "auth.signIn")}
              </Button>
              {PHONE_AUTH_ENABLED && (
                <>
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">{t(locale, "auth.or")}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setMethod("phone");
                      setError(null);
                    }}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    {t(locale, "auth.signInWithPhone")}
                  </Button>
                </>
              )}
            </form>
          ) : PHONE_AUTH_ENABLED ? (
            <form className="space-y-4" onSubmit={handleSendOTP}>
              <div className="space-y-2">
                <Label htmlFor="phone">{t(locale, "auth.phoneLabel")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder={t(locale, "auth.phonePlaceholder")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">
                  {t(locale, "auth.phoneHint")}
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t(locale, "auth.sendingCode") : t(locale, "auth.sendCode")}
              </Button>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">{t(locale, "auth.or")}</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMethod("email");
                  setError(null);
                }}
              >
                <Lock className="h-4 w-4 mr-2" />
                {t(locale, "auth.signInWithEmail")}
              </Button>
            </form>
          ) : null}
        </CardContent>
        <CardFooter className="justify-center border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {t(locale, "auth.noAccount")}{" "}
            <Link
              href="/register"
              className="text-primary hover:underline font-medium"
            >
              {t(locale, "auth.register")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
