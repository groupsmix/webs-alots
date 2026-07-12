"use client";

import * as Sentry from "@sentry/nextjs";
import { UserPlus, ShieldCheck, ArrowLeft, Eye, EyeOff, HeartPulse, Mail } from "lucide-react";
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
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { registerPatient, verifyOTP } from "@/lib/auth";
import { registerWithEmail, signInWithGoogle } from "@/lib/auth-providers";
import { t, type TranslationKey } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import { isMinorByAge, MINOR_AGE_THRESHOLD } from "@/lib/minors";
import { passwordPolicySchema } from "@/lib/validations/password-policy";

const PHONE_AUTH_ENABLED = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true";

const STEPS = [
  { key: "info", label: "Informations" },
  { key: "otp", label: "Vérification" },
] as const;

export default function RegisterPage() {
  const [locale] = useLocale();
  const [step, setStep] = useState<"info" | "otp" | "email-success">("info");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [insurance, setInsurance] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const parsedAge = age ? parseInt(age, 10) : undefined;
  const patientIsMinor = parsedAge !== undefined && !isNaN(parsedAge) && isMinorByAge(parsedAge);
  async function handlePhoneRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (patientIsMinor && !guardianConsent) {
      setError(t(locale, "register.guardianConsentRequired" as TranslationKey));
      return;
    }

    if (password) {
      const passwordResult = passwordPolicySchema.safeParse(password);
      if (!passwordResult.success) {
        setError(passwordResult.error.issues[0].message);
        return;
      }
    }

    setLoading(true);

    try {
      const result = await registerPatient({
        phone,
        name: `${firstName} ${lastName}`.trim(),
        email: email || undefined,
        age: parsedAge,
        gender: gender || undefined,
        insurance: insurance || undefined,
        guardianConsent: patientIsMinor ? guardianConsent : undefined,
      });

      if (result.error) {
        setError(t(locale, result.error as TranslationKey));
        setLoading(false);
        return;
      }

      setStep("otp");
      setLoading(false);
    } catch (err) {
      logger.warn("Registration failed", { context: "register", error: err });
      Sentry.captureException(err, { tags: { flow: "register", method: "phone" } });
      setError(t(locale, "error.unexpected"));
      setLoading(false);
    }
  }

  async function handleEmailRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t(locale, "auth.invalidEmail"));
      return;
    }

    if (!password) {
      setError(t(locale, "auth.passwordTooShort"));
      return;
    }

    const passwordResult = passwordPolicySchema.safeParse(password);
    if (!passwordResult.success) {
      setError(passwordResult.error.issues[0].message);
      return;
    }

    if (patientIsMinor && !guardianConsent) {
      setError(t(locale, "register.guardianConsentRequired" as TranslationKey));
      return;
    }

    setLoading(true);

    try {
      const result = await registerWithEmail({
        email: email.trim(),
        password,
        firstName,
        lastName,
        age: parsedAge,
        gender: gender || undefined,
        insurance: insurance || undefined,
        guardianConsent: patientIsMinor ? guardianConsent : undefined,
      });

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setStep("email-success");
      setLoading(false);
    } catch (err) {
      logger.warn("Email registration failed", { context: "register", error: err });
      // A thrown error here (vs. a returned result.error) means the browser
      // Supabase client itself failed to initialise/call — most often because
      // NEXT_PUBLIC_SUPABASE_* were not inlined into the client bundle at build
      // time. That is invisible server-side, so capture it explicitly.
      Sentry.captureException(err, { tags: { flow: "register", method: "email" } });
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
      logger.warn("OTP verification failed", { context: "register", error: err });
      Sentry.captureException(err, { tags: { flow: "register", method: "otp" } });
      setError(t(locale, "error.unexpected"));
      setLoading(false);
    }
  }

  // Email success confirmation screen
  if (step === "email-success") {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="mb-6 text-center lg:hidden">
          <div className="flex items-center justify-center gap-2 mb-2">
            <HeartPulse className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">Oltigo Health</span>
          </div>
          <p className="text-sm text-muted-foreground">Votre plateforme santé de confiance</p>
        </div>

        <Card className="shadow-lg border-0 sm:border">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">
              {t(locale, "auth.registerSuccess" as TranslationKey)}
            </CardTitle>
            <CardDescription>
              {t(locale, "auth.registerSuccessDesc" as TranslationKey)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors w-full"
            >
              {t(locale, "auth.signIn")}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Mobile-only branding header */}

      <div className="mb-6 text-center lg:hidden">
        <div className="flex items-center justify-center gap-2 mb-2">
          <HeartPulse className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight">Oltigo Health</span>
        </div>
        <p className="text-sm text-muted-foreground">Votre plateforme santé de confiance</p>
      </div>

      <Card className="shadow-lg border-0 sm:border">
        <CardHeader className="text-center pb-4">
          {/* Progress steps indicator — only show for phone auth with OTP step */}
          {PHONE_AUTH_ENABLED && (
            <div className="flex items-center justify-center gap-2 mb-4">
              {STEPS.map((s, idx) => (
                <div key={s.key} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      idx <= currentStepIndex
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {idx < currentStepIndex ? (
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={`hidden sm:inline text-xs font-medium ${
                      idx <= currentStepIndex ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 w-8 sm:w-12 rounded-full transition-colors ${
                        idx < currentStepIndex ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {step === "info" ? (
              <UserPlus className="h-6 w-6 text-primary" />
            ) : (
              <ShieldCheck className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {step === "info" ? t(locale, "register.createAccount") : t(locale, "auth.verifyNumber")}
          </CardTitle>
          <CardDescription className="text-sm">
            {step === "info"
              ? PHONE_AUTH_ENABLED
                ? t(locale, "register.desc")
                : t(locale, "auth.registerEmailDesc" as TranslationKey)
              : `${t(locale, "auth.otpSent")} ${phone}`}
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

          {step === "info" ? (
            <form
              className="space-y-4"
              onSubmit={PHONE_AUTH_ENABLED ? handlePhoneRegister : handleEmailRegister}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t(locale, "register.firstName")}</Label>
                  <Input
                    id="firstName"
                    placeholder={t(locale, "register.firstNamePlaceholder")}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t(locale, "register.lastName")}</Label>
                  <Input
                    id="lastName"
                    placeholder={t(locale, "register.lastNamePlaceholder")}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
              </div>
              {PHONE_AUTH_ENABLED && (
                <div className="space-y-2">
                  <Label htmlFor="phone">{t(locale, "auth.phoneLabel")}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+212 6XX XX XX XX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">
                  {PHONE_AUTH_ENABLED
                    ? t(locale, "register.emailOptional")
                    : t(locale, "auth.email")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required={!PHONE_AUTH_ENABLED}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  {PHONE_AUTH_ENABLED
                    ? `${t(locale, "auth.password" as TranslationKey)} (${t(locale, "register.emailOptional" as TranslationKey)})`
                    : t(locale, "auth.password" as TranslationKey)}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!PHONE_AUTH_ENABLED}
                    className="h-11 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    aria-label={
                      showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                    }
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <PasswordStrengthIndicator password={password} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="age">{t(locale, "register.age")}</Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder="30"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">{t(locale, "register.gender")}</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger>
                      <SelectValue placeholder={t(locale, "register.genderPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">{t(locale, "register.male")}</SelectItem>
                      <SelectItem value="F">{t(locale, "register.female")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="insurance">{t(locale, "register.insuranceOptional")}</Label>
                <Select value={insurance} onValueChange={setInsurance}>
                  <SelectTrigger>
                    <SelectValue placeholder={t(locale, "register.noInsurance")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CNSS">CNSS</SelectItem>
                    <SelectItem value="CNOPS">CNOPS</SelectItem>
                    <SelectItem value="other">{t(locale, "register.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {patientIsMinor && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-sm font-medium text-amber-900">
                    {`Ce patient a moins de ${MINOR_AGE_THRESHOLD} ans. Le consentement d'un parent ou tuteur légal est requis (Loi 09-08 / RGPD Art. 8).`}
                  </p>
                  <label className="flex items-start gap-2 text-sm text-amber-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guardianConsent}
                      onChange={(e) => setGuardianConsent(e.target.checked)}
                      className="mt-0.5 rounded border-amber-300"
                    />
                    <span>
                      {
                        "Je confirme être le parent ou tuteur légal de ce patient mineur et je consens au traitement de ses données de santé."
                      }
                    </span>
                  </label>
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold"
                disabled={loading || (patientIsMinor && !guardianConsent)}
              >
                {loading ? t(locale, "register.creating") : t(locale, "register.createAccount")}
              </Button>
            </form>
          ) : (
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
                  {t(locale, "register.otpHint")}
                </p>
              </div>
              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold"
                disabled={loading}
              >
                {loading ? t(locale, "auth.verifying") : t(locale, "register.verifyAndFinish")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("info");
                  setOtp("");
                  setError(null);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t(locale, "register.backToRegister")}
              </Button>
            </form>
          )}
        </CardContent>
        {/* Google sign-in option */}
        {step === "info" && (
          <div className="px-6 pb-2">
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  {t(locale, "auth.orContinueWith" as TranslationKey)}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full h-11"
              disabled={googleLoading}
              onClick={async () => {
                setGoogleLoading(true);
                setError(null);
                const result = await signInWithGoogle();
                if (result.error) {
                  setError(result.error);
                  setGoogleLoading(false);
                }
              }}
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {googleLoading
                ? t(locale, "auth.signingIn")
                : t(locale, "auth.signInWithGoogle" as TranslationKey)}
            </Button>
          </div>
        )}
        <CardFooter className="justify-center border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {t(locale, "auth.hasAccount")}{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              {t(locale, "auth.signIn")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
