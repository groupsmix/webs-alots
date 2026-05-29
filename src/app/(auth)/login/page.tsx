"use client";

import { Phone, ArrowLeft, Lock, Key, Mail, Eye, EyeOff, HeartPulse } from "lucide-react";
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
import {
  signInWithOTP,
  verifyOTP,
  signInWithPassword,
  signInWithEmailOTP,
  verifyEmailOTP,
} from "@/lib/auth";
import { t, type TranslationKey } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-client";
const PHONE_AUTH_ENABLED = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true";

export default function LoginPage() {
  const [locale] = useLocale();
  const [method, setMethod] = useState<"email" | "phone" | "email-otp">("email");
  const [step, setStep] = useState<"credentials" | "otp" | "email-otp-verify" | "mfa" | "backup">(
    "credentials",
  );
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });

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

  async function handleSendEmailOTP(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFieldErrors({ email: t(locale, "auth.invalidEmail") });
      return;
    }
    setFieldErrors({});
    setLoading(true);

    try {
      const result = await signInWithEmailOTP(trimmedEmail);

      if (result.error) {
        setError(t(locale, result.error as TranslationKey));
        setLoading(false);
        return;
      }

      setStep("email-otp-verify");
      startOtpCooldown();
      setLoading(false);
    } catch (err) {
      logger.warn("Email OTP send failed", { context: "login", error: err });
      setError(t(locale, "error.unexpected"));
      setLoading(false);
    }
  }

  async function handleVerifyEmailOTP(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await verifyEmailOTP(email.trim(), emailOtpCode);
      if (result.error) {
        setError(t(locale, result.error as TranslationKey));
        setLoading(false);
      }
    } catch (err) {
      logger.warn("Email OTP verification failed", { context: "login", error: err });
      setError(t(locale, "error.unexpected"));
      setLoading(false);
    }
  }

  const methodTabs = [
    { key: "email" as const, label: "E-mail", icon: Mail },
    { key: "email-otp" as const, label: "Code e-mail", icon: Lock },
    ...(PHONE_AUTH_ENABLED ? [{ key: "phone" as const, label: "Téléphone", icon: Phone }] : []),
  ];

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Mobile-only branding header */}
      {/* eslint-disable i18next/no-literal-string -- brand name and tagline */}
      <div className="mb-6 text-center lg:hidden">
        <div className="flex items-center justify-center gap-2 mb-2">
          <HeartPulse className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight">Oltigo Health</span>
        </div>
        <p className="text-sm text-muted-foreground">Votre plateforme santé de confiance</p>
      </div>
      {/* eslint-enable i18next/no-literal-string */}

      <Card className="shadow-lg border-0 sm:border">
        <CardHeader className="pb-4 text-center">
          <CardTitle className="text-2xl font-bold">
            {step === "otp"
              ? t(locale, "auth.verifyNumber")
              : step === "email-otp-verify"
                ? t(locale, "auth.verifyEmail" as TranslationKey)
                : step === "mfa"
                  ? t(locale, "auth.mfaTitle" as TranslationKey)
                  : step === "backup"
                    ? t(locale, "auth.mfaBackupTitle" as TranslationKey)
                    : t(locale, "auth.login")}
          </CardTitle>
          <CardDescription className="text-sm">
            {step === "otp"
              ? `${t(locale, "auth.otpSent")} ${phone}`
              : step === "email-otp-verify"
                ? `${t(locale, "auth.emailOtpSent" as TranslationKey)} ${email.trim()}`
                : step === "mfa"
                  ? t(locale, "auth.mfaDesc" as TranslationKey)
                  : step === "backup"
                    ? t(locale, "auth.mfaBackupDesc" as TranslationKey)
                    : method === "email-otp"
                      ? t(locale, "auth.emailOtpDesc" as TranslationKey)
                      : method === "email"
                        ? t(locale, "auth.emailLoginDesc")
                        : t(locale, "auth.phoneLoginDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
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
              <Button
                type="submit"
                className="w-full h-11"
                disabled={loading || mfaCode.length !== 6}
              >
                {loading
                  ? t(locale, "auth.verifying")
                  : t(locale, "auth.mfaVerifyButton" as TranslationKey)}
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
                <Label htmlFor="backup-code">
                  {t(locale, "auth.mfaBackupCodeLabel" as TranslationKey)}
                </Label>
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
              <Button
                type="submit"
                className="w-full h-11"
                disabled={loading || backupCode.length < 8}
              >
                {loading
                  ? t(locale, "auth.verifying")
                  : t(locale, "auth.mfaVerifyButton" as TranslationKey)}
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
                    {otpCooldown > 0
                      ? `${t(locale, "auth.resendCountdown")} (${otpCooldown}s)`
                      : t(locale, "auth.resend")}
                  </button>
                </p>
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
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
          ) : step === "email-otp-verify" ? (
            <form className="space-y-4" onSubmit={handleVerifyEmailOTP}>
              <div className="space-y-2">
                <Label htmlFor="email-otp-code">{t(locale, "auth.otpLabel")}</Label>
                <Input
                  id="email-otp-code"
                  placeholder="00000000"
                  maxLength={8}
                  className="text-center text-2xl tracking-widest font-mono"
                  value={emailOtpCode}
                  onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">
                  {t(locale, "auth.otpNotReceived")}{" "}
                  <button
                    type="button"
                    className={`text-primary hover:underline ${otpCooldown > 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={() => handleSendEmailOTP()}
                    disabled={otpCooldown > 0}
                  >
                    {otpCooldown > 0
                      ? `${t(locale, "auth.resendCountdown")} (${otpCooldown}s)`
                      : t(locale, "auth.resend")}
                  </button>
                </p>
              </div>
              <Button
                type="submit"
                className="w-full h-11"
                disabled={loading || emailOtpCode.length < 6}
              >
                {loading ? t(locale, "auth.verifying") : t(locale, "auth.verifyAndLogin")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("credentials");
                  setEmailOtpCode("");
                  setError(null);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t(locale, "auth.useAnotherEmail" as TranslationKey)}
              </Button>
            </form>
          ) : (
            <>
              {/* ── Pill tabs for auth method selection ── */}
              {step === "credentials" && (
                <div className="mb-5 flex rounded-lg bg-muted p-1 gap-1">
                  {methodTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        setMethod(tab.key);
                        setError(null);
                        setFieldErrors({});
                      }}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                        method === tab.key
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <tab.icon className="h-3.5 w-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* ── Email + password form ── */}
              {method === "email" ? (
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
                        if (fieldErrors.email)
                          setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      required
                      className={`h-11 text-base ${fieldErrors.email ? "border-destructive" : ""}`}
                      aria-invalid={!!fieldErrors.email}
                      aria-describedby={fieldErrors.email ? "email-error" : undefined}
                    />
                    {fieldErrors.email && (
                      <p id="email-error" className="text-xs text-destructive">
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{t(locale, "auth.password")}</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t(locale, "auth.passwordPlaceholder")}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (fieldErrors.password)
                            setFieldErrors((prev) => ({ ...prev, password: undefined }));
                        }}
                        required
                        className={`h-11 pr-10 text-base ${fieldErrors.password ? "border-destructive" : ""}`}
                        aria-invalid={!!fieldErrors.password}
                        aria-describedby={fieldErrors.password ? "password-error" : undefined}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={
                          showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p id="password-error" className="text-xs text-destructive">
                        {fieldErrors.password}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                      {t(locale, "auth.forgotPassword")}
                    </Link>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 text-sm font-semibold"
                    disabled={loading}
                  >
                    {loading ? t(locale, "auth.signingIn") : t(locale, "auth.signIn")}
                  </Button>
                </form>
              ) : method === "email-otp" ? (
                /* ── Email OTP form ── */
                <form className="space-y-4" onSubmit={handleSendEmailOTP}>
                  <div className="space-y-2">
                    <Label htmlFor="email-otp">{t(locale, "auth.email")}</Label>
                    <Input
                      id="email-otp"
                      type="email"
                      placeholder={t(locale, "auth.emailPlaceholder")}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email)
                          setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      required
                      className={`h-11 text-base ${fieldErrors.email ? "border-destructive" : ""}`}
                      aria-invalid={!!fieldErrors.email}
                      aria-describedby={fieldErrors.email ? "email-otp-error" : undefined}
                    />
                    {fieldErrors.email && (
                      <p id="email-otp-error" className="text-xs text-destructive">
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 text-sm font-semibold"
                    disabled={loading}
                  >
                    {loading
                      ? t(locale, "auth.sendingEmailCode" as TranslationKey)
                      : t(locale, "auth.sendEmailCode" as TranslationKey)}
                  </Button>
                </form>
              ) : PHONE_AUTH_ENABLED ? (
                /* ── Phone OTP form ── */
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
                      className="h-11 text-base"
                    />
                    <p className="text-xs text-muted-foreground">{t(locale, "auth.phoneHint")}</p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 text-sm font-semibold"
                    disabled={loading}
                  >
                    {loading ? t(locale, "auth.sendingCode") : t(locale, "auth.sendCode")}
                  </Button>
                </form>
              ) : null}
            </>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {t(locale, "auth.noAccount")}{" "}
            <Link href="/register" className="text-primary hover:underline font-medium">
              {t(locale, "auth.register")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
