/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

const TIERS = ["trial", "starter", "pro", "enterprise"] as const;
type Tier = (typeof TIERS)[number];

const TIER_FEATURES: Record<Tier, string[]> = {
  trial: ["Accès limité 14 jours"],
  starter: ["Jusqu'à 3 médecins", "WhatsApp basique", "200 rendez-vous/mois"],
  pro: ["Médecins illimités", "WhatsApp avancé", "Rappels automatiques", "Prescriptions PDF"],
  enterprise: [
    "Toutes fonctionnalités Pro",
    "SLA 99.9%",
    "Support prioritaire",
    "Domaine personnalisé",
  ],
};

export function SubscriptionTierForm({
  clinicId,
  currentTier,
}: {
  clinicId: string;
  currentTier: string;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [selectedTier, setSelectedTier] = useState<Tier>(currentTier as Tier);
  const [pendingTier, setPendingTier] = useState<Tier | null>(null);
  const [loading, setLoading] = useState(false);

  const tierIndex = (t: Tier) => TIERS.indexOf(t);
  const isDowngrade = pendingTier ? tierIndex(pendingTier) < tierIndex(currentTier as Tier) : false;

  async function handleConfirm() {
    if (!pendingTier) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/clinics/${clinicId}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: pendingTier }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Erreur inconnue");
      setSelectedTier(pendingTier);
      addToast(`Plan changé vers ${pendingTier}.`, "success");
      router.refresh();
    } catch (err) {
      addToast(`Erreur : ${String(err)}`, "error");
    } finally {
      setLoading(false);
      setPendingTier(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tier-select">Nouveau plan</Label>
        <Select value={selectedTier} onValueChange={(v) => setPendingTier(v as Tier)}>
          <SelectTrigger id="tier-select" className="w-full">
            <SelectValue placeholder="Sélectionner un plan" value={selectedTier} />
          </SelectTrigger>
          <SelectContent>
            {TIERS.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedTier && (
        <div className="rounded-lg border p-3 bg-muted/50 text-sm">
          <p className="font-medium mb-1">Fonctionnalités incluses :</p>
          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
            {TIER_FEATURES[selectedTier].map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={!!pendingTier} onOpenChange={(open) => !open && setPendingTier(null)}>
        {pendingTier && (
          <DialogContent onClose={() => setPendingTier(null)}>
            <DialogHeader>
              <DialogTitle>
                {isDowngrade ? "⚠️ Confirmer la rétrogradation" : "Confirmer le changement de plan"}
              </DialogTitle>
              <DialogDescription>
                {isDowngrade
                  ? `Passer à "${pendingTier}" désactivera certaines fonctionnalités actuellement actives pour cette clinique. Cette action est immédiate.`
                  : `Changer le plan vers "${pendingTier}". Cette action prendra effet immédiatement.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingTier(null)} disabled={loading}>
                Annuler
              </Button>
              <Button onClick={handleConfirm} disabled={loading}>
                {loading ? "En cours..." : "Confirmer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
