/* eslint-disable i18next/no-literal-string -- patient experience UI strings */
"use client";

import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QrCheckinResultProps {
  token: string;
}

interface CheckinResponse {
  ok: boolean;
  data?: {
    checkedIn: boolean;
    queuePosition: number;
    estimatedWait: number;
    appointmentId: string;
  };
  error?: string;
}

export function QrCheckinResult({ token }: QrCheckinResultProps) {
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function processCheckin() {
      try {
        const res = await fetch("/api/checkin/qr-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as CheckinResponse;
        setResult(data);
      } catch {
        setResult({ ok: false, error: "Connection error. Please try again." });
      } finally {
        setLoading(false);
      }
    }

    processCheckin();
  }, [token]);

  if (loading) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="py-8 text-center">
          <Clock className="h-8 w-8 mx-auto mb-2 animate-spin text-blue-500" />
          <p className="text-sm">Processing check-in...</p>
        </CardContent>
      </Card>
    );
  }

  if (!result?.ok) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="py-8 text-center">
          <XCircle className="h-12 w-12 mx-auto mb-3 text-red-500" />
          <p className="text-lg font-medium">Check-in Failed</p>
          <p className="text-sm text-muted-foreground mt-1">{result?.error ?? "Unknown error"}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          Check-in Successful
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-3">
        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
          <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
            #{result.data?.queuePosition}
          </p>
          <p className="text-sm text-muted-foreground">Your position in queue</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm">Estimated wait: ~{result.data?.estimatedWait} minutes</span>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Please take a seat. You will be called when it&apos;s your turn.
        </p>
      </CardContent>
    </Card>
  );
}
