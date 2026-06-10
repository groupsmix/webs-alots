/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: same i18n posture as page.tsx */
"use client";

import { AlertTriangle, Loader2, OctagonX, Power } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface KillSwitchState {
  ai_enabled: boolean;
  env_locked: boolean;
  kv_available: boolean;
}

/**
 * Emergency AI kill switch.
 *
 * Stops ALL AI traffic platform-wide by flipping the `ai.enabled` flag in
 * FEATURE_FLAGS_KV — the same flag every AI route checks (F-AI-01). Disabling
 * requires typing STOP in a confirmation dialog; re-enabling requires its own
 * confirmation. Server enforces a second `confirm: true` guard.
 */
export function EmergencyStop() {
  const { addToast } = useToast();
  const [state, setState] = useState<KillSwitchState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [working, setWorking] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-kill-switch");
      const json = (await res.json()) as { ok: boolean; data?: KillSwitchState };
      if (json.ok && json.data) setState(json.data);
    } catch {
      // Leave state null — section renders a degraded notice
    }
  }, []);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  const flip = async (enabled: boolean) => {
    setWorking(true);
    try {
      const res = await fetch("/api/admin/ai-kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, confirm: true }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) {
        addToast(
          enabled ? "AI re-enabled platform-wide" : "EMERGENCY STOP — all AI is now disabled",
          enabled ? "success" : "error",
        );
        setDialogOpen(false);
        setConfirmText("");
        await fetchState();
      } else {
        addToast(json.error ?? "Failed to update the kill switch", "error");
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setWorking(false);
    }
  };

  if (!state) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex items-center gap-3 p-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking AI emergency stop status…</p>
        </CardContent>
      </Card>
    );
  }

  const stopped = !state.ai_enabled;

  return (
    <>
      <Card className={stopped ? "border-destructive bg-destructive/5" : "border-destructive/40"}>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-lg p-2 ${stopped ? "bg-destructive/20" : "bg-destructive/10"}`}
            >
              <OctagonX className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="font-semibold">
                {stopped ? "AI is STOPPED platform-wide" : "Emergency Stop"}
              </p>
              <p className="text-sm text-muted-foreground">
                {stopped
                  ? state.env_locked
                    ? "Disabled via the AI_DISABLED environment variable — remove the env override to re-enable."
                    : "All AI requests are rejected. No provider is being called and no spend is occurring."
                  : "Instantly stop every AI feature and all provider spend. Takes effect within seconds."}
              </p>
            </div>
          </div>
          {stopped ? (
            <Button
              variant="outline"
              onClick={() => setDialogOpen(true)}
              disabled={working || state.env_locked}
            >
              <Power className="mr-2 h-4 w-4 text-green-500 dark:text-green-400" />
              Re-enable AI
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setDialogOpen(true)}
              disabled={working || !state.kv_available}
            >
              <OctagonX className="mr-2 h-4 w-4" />
              STOP ALL AI
            </Button>
          )}
        </CardContent>
        {!state.kv_available && !stopped && (
          <CardContent className="border-t px-4 py-2">
            <p className="text-xs text-muted-foreground">
              <AlertTriangle className="mr-1 inline h-3 w-3" />
              Feature flag storage is unavailable in this environment — use the AI_DISABLED
              environment variable instead.
            </p>
          </CardContent>
        )}
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setConfirmText("");
        }}
      >
        <DialogContent>
          {stopped ? (
            <>
              <DialogHeader>
                <DialogTitle>Re-enable AI platform-wide?</DialogTitle>
                <DialogDescription>
                  All AI features will resume immediately, including provider spend. Make sure the
                  issue that triggered the emergency stop is resolved.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={working}>
                  Cancel
                </Button>
                <Button onClick={() => void flip(true)} disabled={working}>
                  {working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Re-enable AI
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Emergency stop — all AI
                </DialogTitle>
                <DialogDescription>
                  This immediately disables EVERY AI feature platform-wide: chatbot, summaries,
                  triage, transcription, all of it. All provider spend stops. Clinics will see AI
                  features as unavailable until you re-enable them here.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Type <span className="font-mono font-bold">STOP</span> to confirm:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="STOP"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={working}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void flip(false)}
                  disabled={working || confirmText.trim().toUpperCase() !== "STOP"}
                >
                  {working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Stop all AI now
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
