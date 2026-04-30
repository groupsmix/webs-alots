"use client";

import { UserPlus, ShieldCheck, ArrowLeft, Heart } from "lucide-react";
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

const PHONE_AUTH_ENABLED = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true";

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
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // A200: Morocco legal majority is 18
  const MAJORITY_AGE = 18;
  const isMinor = age !== "" && parseInt(age, 10) < MAJORITY_AGE && parseInt(age, 10) > 0;
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!PHONE_AUTH_ENABLED) {
      setError(t(locale, "auth.phoneDisabled"));
      return;
    }

    setLoading(true);

    // A200: Block registration of minors without guardian consent
    if (isMinor && !guardianConsent) {
      setError(t(locale, "register.guardianConsentRequired" as TranslationKey));
      return;
    }
    if (isMinor && !guardianName.trim()) {
      setError(t(locale, "register.guardianNameRequired" as TranslationKey));
      return;
    }
    if (isMinor && !guardianPhone.trim()) {
      setError(t(locale, "register.guardianPhoneRequired" as TranslationKey));
      return;
    }

    try {
      const result = await registerPatient({
        phone,
        name: `${firstName} ${lastName}`.trim(),
        email: email || undefined,
        age: age ? parseInt(age, 10) : undefined,
        gender: gender || undefined,
        insurance: insurance || undefined,
        // A200: Guardian data for minors
        isMinor: isMinor || false,
        guardianName: isMinor ? guardianName : undefined,
        guardianPhone: isMinor ? guardianPhone : undefined,
        guardianEmail: isMinor ? guardianEmail : undefined,
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
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Heart className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-xl font-bold">{t(locale, "auth.portalTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t(locale, "register.subtitle")}</p>
        </div>

        <Card>
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <UserPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl">{t(locale, "register.unavailableTitle")}</CardTitle>
            <CardDescription>
              {t(locale, "register.unavailableDesc")}
            </CardDescription>
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
              <Link
                href="/login"
                className="text-primary hover:underline font-medium"
              >
                {t(locale, "auth.signIn")}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    );
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
        <p className="text-sm text-muted-foreground">{t(locale, "register.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {step === "info" ? (
              <UserPlus className="h-6 w-6 text-primary" />
            ) : (
              <ShieldCheck className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle className="text-xl">
            {step === "info" ? t(locale, "register.createAccount") : t(locale, "auth.verifyNumber")}
          </CardTitle>
          <CardDescription>
            {step === "info"
              ? t(locale, "register.desc")
              : `${t(locale, "auth.otpSent")} ${phone}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
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
                />
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
              {/* A200: Guardian consent section for minor patients */}
              {isMinor && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        {t(locale, "register.minorNotice" as TranslationKey)}
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        {t(locale, "register.minorNoticeDesc" as TranslationKey)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guardianName">{t(locale, "register.guardianName" as TranslationKey)}</Label>
                    <Input
                      id="guardianName"
                      placeholder={t(locale, "register.guardianNamePlaceholder" as TranslationKey)}
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guardianPhone">{t(locale, "register.guardianPhone" as TranslationKey)}</Label>
                    <Input
                      id="guardianPhone"
                      type="tel"
                      placeholder="+212 6XX XX XX XX"
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guardianEmail">{t(locale, "register.guardianEmailOptional" as TranslationKey)}</Label>
                    <Input
                      id="guardianEmail"
                      type="email"
                      placeholder="parent@email.com"
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                    />
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guardianConsent}
                      onChange={(e) => setGuardianConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                      required
                    />
                    <span className="text-xs text-amber-800">
                      {t(locale, "register.guardianConsentLabel" as TranslationKey)}
                    </span>
                  </label>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || (isMinor && !guardianConsent)}>
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
              <Button type="submit" className="w-full" disabled={loading}>
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
            <Link
              href="/login"
              className="text-primary hover:underline font-medium"
            >
              {t(locale, "auth.signIn")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
