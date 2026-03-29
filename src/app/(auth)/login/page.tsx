"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Phone, ShieldCheck, ArrowLeft, Heart, Mail, Lock } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { signInWithOTP, verifyOTP, signInWithPassword } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { t, type TranslationKey } from "@/lib/i18n";
import { useLocale } from "@/components/locale-switcher";
const PHONE_AUTH_ENABLED = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true";

export default function LoginPage() {
  const [locale] = useLocale();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
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
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    setLoading(true);

    try {
      const result = await signInWithPassword(email.trim(), password);
      if (result.error) {
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
            {step === "otp" ? (
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
              : t(locale, "auth.login")}
          </CardTitle>
          <CardDescription>
            {step === "otp"
              ? `${t(locale, "auth.otpSent")} ${phone}`
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

          {step === "otp" && PHONE_AUTH_ENABLED ? (
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
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t(locale, "auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t(locale, "auth.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="text-base"
                />
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
