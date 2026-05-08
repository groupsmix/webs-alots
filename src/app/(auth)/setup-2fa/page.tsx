"use client";

import { ShieldCheck, Copy, Check, ArrowLeft, AlertTriangle, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
import {
  enrollMFA,
  verifyMFAEnrollment,
  generateBackupCodes,
} from "@/lib/mfa";
import type { MFAEnrollment } from "@/lib/mfa";
import { formatDisplayDate } from "@/lib/utils";

type Step = "loading" | "qr" | "verify" | "backup" | "done";

export default function Setup2FAPage() {
  const router = useRouter();
  const [locale] = useLocale();
  const [step, setStep] = useState<Step>("loading");
  const [enrollment, setEnrollment] = useState<MFAEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupCopied, setBackupCopied] = useState(false);

  useEffect(() => {
    async function startEnrollment() {
      const result = await enrollMFA();
      if (result.error || !result.data) {
        setError(result.error ?? "Failed to start enrollment");
        setStep("qr");
        return;
      }
      setEnrollment(result.data);
      setStep("qr");
    }
    startEnrollment();
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollment) return;
    setError(null);
    setLoading(true);

    const result = await verifyMFAEnrollment(enrollment.factorId, code);
    if (result.error) {
      setError(t(locale, "mfa.invalidCode"));
      setLoading(false);
      return;
    }

    // Generate backup codes after successful enrollment
    const backupResult = await generateBackupCodes();
    if (backupResult.codes) {
      setBackupCodes(backupResult.codes);
      setStep("backup");
    } else {
      setStep("done");
    }
    setLoading(false);
  }

  function handleCopySecret() {
    if (!enrollment) return;
    navigator.clipboard.writeText(enrollment.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyBackupCodes() {
    const codesText = backupCodes.join("\n");
    navigator.clipboard.writeText(codesText);
    setBackupCopied(true);
    setTimeout(() => setBackupCopied(false), 2000);
  }

  function handleDownloadBackupCodes() {
    const codesText = [
      "=== Codes de secours 2FA ===",
      "Conservez ces codes en lieu sûr.",
      "Chaque code ne peut être utilisé qu'une seule fois.",
      "",
      ...backupCodes,
      "",
      `Générés le: ${formatDisplayDate(new Date(), locale, "datetime")}`,
    ].join("\n");

    const blob = new Blob([codesText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-codes-2fa.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (step === "loading") {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">{ t(locale, "mfa.setupTitle") + "..." }</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "backup") {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle className="text-xl">{ t(locale, "mfa.backupCodes") }</CardTitle>
            <CardDescription>{ t(locale, "mfa.backupCodesDesc") }</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((c) => (
                  <code
                    key={c}
                    className="text-sm font-mono bg-background rounded px-2 py-1 text-center"
                  >
                    {c}
                  </code>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCopyBackupCodes}
              >
                {backupCopied ? (
                  <Check className="h-4 w-4 mr-1" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                {backupCopied ? t(locale, "action.copied" as TranslationKey) || "Copié" : t(locale, "action.copy" as TranslationKey) || "Copier"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDownloadBackupCodes}
              >
                <Download className="h-4 w-4 mr-1" />
                {t(locale, "mfa.downloadCodes")}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">{ t(locale, "mfa.backupCodesDesc") }</p>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => router.push("/doctor/dashboard")}
            >{ t(locale, "mfa.goToDashboard") }</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <ShieldCheck className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">{ t(locale, "mfa.enabled") }</h2>
            <p className="text-muted-foreground mb-6">{ t(locale, "mfa.setupCompleteDesc") }</p>
            <Button onClick={() => router.push("/doctor/dashboard")}>{ t(locale, "mfa.goToDashboard") }</Button>
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
        <h1 className="text-xl font-bold">{ t(locale, "mfa.setupTitle") }</h1>
        <p className="text-sm text-muted-foreground">{ t(locale, "mfa.setupDesc") }</p>
      </div>

      <Card>
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-lg">
            {step === "qr"
              ? t(locale, "mfa.scanQR")
              : t(locale, "mfa.verifyTitle")}
          </CardTitle>
          <CardDescription>
            {step === "qr"
              ? t(locale, "mfa.setupDesc")
              : t(locale, "mfa.verifyDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && !enrollment && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {step === "qr" && enrollment && (
            <div className="space-y-4">
              {/* QR Code — render client-side from TOTP URI for safety.
                  enrollment.qrCode comes from Supabase's MFA API and is expected
                  to be a safe SVG data URL, but rendering it via dangerouslySetInnerHTML
                  would be risky if the API response were ever tampered with (MITM,
                  Supabase compromise). Instead we validate it's a data URI before use. */}
              <div className="flex justify-center">
                {enrollment.qrCode.startsWith("data:image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={enrollment.qrCode}
                    alt="QR code pour configuration 2FA"
                    className="bg-white p-4 rounded-lg"
                    width={200}
                    height={200}
                  />
                ) : (
                  <div className="bg-white p-4 rounded-lg text-sm text-muted-foreground">
                    {t(locale, "mfa.manualEntry")}
                  </div>
                )}
              </div>

              {/* Manual entry */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">
                  {t(locale, "mfa.manualEntry")}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-muted rounded px-3 py-2 text-center break-all">
                    {enrollment.secret}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopySecret}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => setStep("verify")}
              >
                {t(locale, "action.next" as TranslationKey) || "Suivant"}
              </Button>
            </div>
          )}

          {step === "verify" && (
            <form className="space-y-4" onSubmit={handleVerify}>
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="totp-code">{t(locale, "mfa.code")}</Label>
                <Input
                  id="totp-code"
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || code.length !== 6}
              >
                {loading ? t(locale, "mfa.verifying" as TranslationKey) : t(locale, "mfa.verify" as TranslationKey)}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("qr");
                  setCode("");
                  setError(null);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t(locale, "action.back" as TranslationKey) || "Retour"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t pt-4">
          <Button
            variant="link"
            className="text-sm text-muted-foreground"
            onClick={() => router.back()}
          >
            {t(locale, "action.cancel" as TranslationKey) || "Annuler"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
