"use client";

import { ShieldCheck, ShieldOff, Key, AlertTriangle, Copy, Check, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { t, type TranslationKey } from "@/lib/i18n";
import {
  getMFAFactors,
  unenrollMFA,
  generateBackupCodes,
} from "@/lib/mfa";
import { formatDisplayDate } from "@/lib/utils";

export function MFASettings() {
  const router = useRouter();
  const [locale] = useLocale();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [disabling, setDisabling] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [backupCopied, setBackupCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFactors() {
      const { factors } = await getMFAFactors();
      const verified = factors.find((f) => f.status === "verified");
      setMfaEnabled(!!verified);
      setFactorId(verified?.id ?? null);
      setLoading(false);
    }
    loadFactors();
  }, []);

  async function handleDisable() {
    if (!factorId) return;
    setDisabling(true);
    setError(null);

    const result = await unenrollMFA(factorId);
    if (result.error) {
      setError(t(locale, "mfa.disableError" as TranslationKey) || "Impossible de désactiver la 2FA.");
      setDisabling(false);
      return;
    }

    setMfaEnabled(false);
    setFactorId(null);
    setDisabling(false);
  }

  async function handleGenerateBackupCodes() {
    setGeneratingCodes(true);
    setError(null);

    const result = await generateBackupCodes();
    if (result.error || !result.codes) {
      setError(t(locale, "mfa.generateError" as TranslationKey) || "Impossible de générer les codes de secours.");
      setGeneratingCodes(false);
      return;
    }

    setBackupCodes(result.codes);
    setShowBackupCodes(true);
    setGeneratingCodes(false);
  }

  function handleCopyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
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

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="animate-pulse flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              mfaEnabled
                ? "bg-green-100 dark:bg-green-900/30"
                : "bg-muted"
            }`}>
              {mfaEnabled ? (
                <ShieldCheck className="h-5 w-5 text-green-600" />
              ) : (
                <ShieldOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <CardTitle className="text-base">
                { t(locale, "mfa.settings") }
              </CardTitle>
              <CardDescription>
                {mfaEnabled
                  ? t(locale, "mfa.enabled")
                  : t(locale, "mfa.settingsDesc")}
              </CardDescription>
            </div>
          </div>
          <Badge variant={mfaEnabled ? "success" : "secondary"}>
            {mfaEnabled ? t(locale, "mfa.enabled") : t(locale, "mfa.disabled")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {mfaEnabled ? (
          <>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateBackupCodes}
                disabled={generatingCodes}
              >
                <Key className="h-4 w-4 mr-1" />
                {generatingCodes
                  ? t(locale, "action.generating" as TranslationKey) || "Génération..."
                  : t(locale, "mfa.regenerateBackupCodes")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisable}
                disabled={disabling}
              >
                <ShieldOff className="h-4 w-4 mr-1" />
                {disabling ? t(locale, "action.disabling" as TranslationKey) || "Désactivation..." : t(locale, "mfa.disable")}
              </Button>
            </div>

            {showBackupCodes && backupCodes.length > 0 && (
              <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-sm font-medium">
                    { t(locale, "mfa.backupCodes") }
                  </p>
                </div>
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyBackupCodes}
                  >
                    {backupCopied ? (
                      <Check className="h-3 w-3 mr-1" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    {backupCopied ? t(locale, "action.copied" as TranslationKey) || "Copié" : t(locale, "action.copy" as TranslationKey) || "Copier"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadBackupCodes}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    { t(locale, "mfa.downloadCodes") }
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <Button
            onClick={() => router.push("/setup-2fa")}
          >
            <ShieldCheck className="h-4 w-4 mr-1" />
            { t(locale, "mfa.enable") }
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
