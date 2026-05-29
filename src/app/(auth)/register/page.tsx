"use client";

import { UserPlus, ShieldCheck, ArrowLeft, Eye, EyeOff, HeartPulse } from "lucide-react";
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
  const [step, setStep] = useState<"info" | "otp">("info");
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

  const parsedAge = age ? parseInt(age, 10) : undefined;
  const patientIsMinor = parsedAge !== undefined && !isNaN(parsedAge) && isMinorByAge(parsedAge);
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!PHONE_AUTH_ENABLED) {
      setError(t(locale, "auth.phoneDisabled"));
      return;
    }

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
      setError(t(locale, "error.unexpected"));
      setLoading(false);
    }
  }

  if (!PHONE_AUTH_ENABLED) {
    return (
      <div className="w-full max-w-md mx-auto">
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
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <UserPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl">{t(locale, "register.unavailableTitle")}</CardTitle>
            <CardDescription>{t(locale, "register.unavailableDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors w-full"
            >
              {t(locale, "nav.contact")}
            </Link>
          </CardContent>
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

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

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
        <CardHeader className="text-center pb-4">
          {/* Progress steps indicator */}
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
            {step === "info" ? t(locale, "register.desc") : `${t(locale, "auth.otpSent")} ${phone}`}
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
            <form className="space-y-4" onSubmit={handleRegister}>
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
              <div className="space-y-2">
                <Label htmlFor="email">{t(locale, "register.emailOptional")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  {t(locale, "auth.password" as TranslationKey)} (
                  {t(locale, "register.emailOptional" as TranslationKey)})
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
