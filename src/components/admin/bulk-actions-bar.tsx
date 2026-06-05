"use client";
/* eslint-disable i18next/no-literal-string -- super-admin internal UI; translation tracked separately */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

interface BulkActionsBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
}

export function BulkActionsBar({ selectedIds, onClearSelection }: BulkActionsBarProps) {
  const router = useRouter();
  const { addToast } = useToast();

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (selectedIds.length === 0) return null;

  const n = selectedIds.length;

  async function handleSuspend() {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/clinics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend", ids: selectedIds }),
      });
      const data: unknown = await res.json();
      if (res.ok) {
        addToast(`${n} clinique(s) suspendues.`, "success");
        onClearSelection();
        router.refresh();
      } else {
        const err = data as { error?: string };
        addToast(err.error ?? "Erreur lors de la suspension.", "error");
      }
    } catch {
      addToast("Erreur réseau.", "error");
    } finally {
      setLoading(false);
      setSuspendOpen(false);
    }
  }

  async function handleAnnounce() {
    if (!message.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/clinics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "announce", ids: selectedIds, message }),
      });
      const data: unknown = await res.json();
      if (res.ok) {
        addToast(`Annonce envoyée à ${n} clinique(s).`, "success");
        onClearSelection();
        router.refresh();
      } else {
        const err = data as { error?: string };
        addToast(err.error ?? "Erreur lors de l'envoi de l'annonce.", "error");
      }
    } catch {
      addToast("Erreur réseau.", "error");
    } finally {
      setLoading(false);
      setAnnounceOpen(false);
      setMessage("");
    }
  }

  function handleExportCSV() {
    window.open(`/api/super-admin/clinics/export?ids=${selectedIds.join(",")}`, "_blank");
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2">
        <span className="text-sm font-medium">
          {n} clinique{n > 1 ? "s" : ""} sélectionnée{n > 1 ? "s" : ""}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="destructive" onClick={() => setSuspendOpen(true)}>
            Suspendre
          </Button>

          <Button size="sm" variant="secondary" onClick={handleExportCSV}>
            Exporter CSV
          </Button>

          <Button size="sm" variant="outline" onClick={() => setAnnounceOpen(true)}>
            Envoyer annonce
          </Button>
        </div>
      </div>

      {/* ── Suspend confirmation dialog ── */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent onClose={() => setSuspendOpen(false)}>
          <DialogHeader>
            <DialogTitle>Confirmer la suspension</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de suspendre{" "}
              <strong>
                {n} clinique{n > 1 ? "s" : ""}
              </strong>
              . Cette action peut être annulée ultérieurement.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)} disabled={loading}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={() => void handleSuspend()} disabled={loading}>
              {loading ? "Suspension…" : "Confirmer la suspension"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Announce dialog ── */}
      <Dialog open={announceOpen} onOpenChange={setAnnounceOpen}>
        <DialogContent onClose={() => setAnnounceOpen(false)}>
          <DialogHeader>
            <DialogTitle>Envoyer une annonce</DialogTitle>
            <DialogDescription>
              Le message sera envoyé par WhatsApp aux{" "}
              <strong>
                {n} clinique{n > 1 ? "s" : ""}
              </strong>{" "}
              sélectionnées.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Saisissez votre message…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={4}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAnnounceOpen(false);
                setMessage("");
              }}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button onClick={() => void handleAnnounce()} disabled={!message.trim() || loading}>
              {loading ? "Envoi…" : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
