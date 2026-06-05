"use client";

/**
 * KycReviewCard
 *
 * Renders approve / reject / request-more-docs action buttons for a
 * single KYC submission row. Used inside the super-admin KYC queue page.
 * On success the page is refreshed via router.refresh() so the RSC data
 * rerenders without a full navigation.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { logger } from "@/lib/logger";

interface KycEntry {
  id:            string;
  review_status: string;
}

type Action = "approve" | "reject" | "request_more_docs";

export function KycReviewCard({ kyc }: { kyc: KycEntry }) {
  const router = useRouter();

  const [busy,        setBusy]        = useState<Action | null>(null);
  const [rejectOpen,  setRejectOpen]  = useState(false);
  const [reason,      setReason]      = useState("");
  const [reasonError, setReasonError] = useState("");

  // Already-approved records get a read-only badge instead of buttons
  if (kyc.review_status === "approved") {
    return <Badge variant="success">Approuvé</Badge>;
  }

  const call = async (action: Action, rejectionReason?: string) => {
    setBusy(action);
    try {
      const res = await fetch(`/api/super-admin/kyc/${kyc.id}/review`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action, reason: rejectionReason }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        logger.warn("KYC review failed", {
          context: "kyc-review-card",
          action,
          error:   data.error,
        });
      }
    } catch (err) {
      logger.warn("KYC review error", { context: "kyc-review-card", error: err });
    } finally {
      setBusy(null);
      setRejectOpen(false);
      setReason("");
    }
  };

  const handleRejectSubmit = () => {
    if (!reason.trim()) {
      setReasonError("La raison est obligatoire pour un rejet.");
      return;
    }
    setReasonError("");
    void call("reject", reason.trim());
  };

  return (
    <div className="flex items-center gap-2 justify-end flex-wrap">
      {/* Approve */}
      <Button
        size="sm"
        disabled={busy !== null}
        onClick={() => void call("approve")}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        {busy === "approve" ? "…" : "Approuver"}
      </Button>

      {/* Reject (opens dialog) */}
      <Button
        size="sm"
        variant="destructive"
        disabled={busy !== null}
        onClick={() => { setRejectOpen(true); setReasonError(""); }}
      >
        Rejeter
      </Button>

      {/* Request more docs */}
      <Button
        size="sm"
        variant="outline"
        disabled={busy !== null}
        onClick={() => void call("request_more_docs")}
      >
        {busy === "request_more_docs" ? "…" : "Demander docs"}
      </Button>

      {/* Rejection reason dialog */}
      <Dialog
        open={rejectOpen}
        onOpenChange={(o) => { setRejectOpen(o); setReasonError(""); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rejeter le dossier KYC</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Motif du rejet (obligatoire)"
            value={reason}
            onChange={(e) => { setReason(e.target.value); setReasonError(""); }}
            rows={3}
            className="resize-none"
          />
          {reasonError && (
            <p className="text-xs text-destructive mt-1">{reasonError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={busy !== null}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={busy !== null}
            >
              {busy === "reject" ? "…" : "Confirmer le rejet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
