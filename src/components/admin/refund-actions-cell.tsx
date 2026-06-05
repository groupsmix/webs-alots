"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export function RefundActionsCell({ refundId }: { refundId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const act = async (type: "approve" | "reject") => {
    setBusy(type);
    try {
      const res = await fetch(`/api/super-admin/refunds/${refundId}/${type}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: type === "reject" ? JSON.stringify({ reason: "Rejeté par super admin" }) : "{}",
      });
      if (res.ok) router.refresh();
    } catch (err) {
      logger.warn("RefundActionsCell error", { context: "refund-actions", error: err });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex gap-2 justify-end">
      <Button
        size="sm"
        disabled={busy !== null}
        onClick={() => void act("approve")}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        {busy === "approve" ? "…" : "Approuver"}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={busy !== null}
        onClick={() => void act("reject")}
      >
        {busy === "reject" ? "…" : "Rejeter"}
      </Button>
    </div>
  );
}
