"use client";

import { Download, Trash2, ShieldCheck, AlertTriangle, Lock, BellOff } from "lucide-react";
import { useState } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { getLocalDateStr } from "@/lib/utils";

// ---------------------------------------------------------------------------
// A69-F3: Per-category processing preferences (Art.21 objection UI)
// ---------------------------------------------------------------------------
const PROCESSING_ACTIVITIES = [
  {
    id: "whatsapp_reminders",
    label: "Rappels WhatsApp",
    description:
      "Rappels automatiques de rendez-vous par WhatsApp. Base juridique : intérêt légitime (Art.6(1)(f)).",
  },
  {
    id: "ai_summaries",
    label: "Résumés IA du dossier",
    description:
      "Génération de résumés de votre dossier médical par intelligence artificielle pour aider votre médecin.",
  },
  {
    id: "ai_prescription_suggestions",
    label: "Suggestions de prescription IA",
    description:
      "Suggestions de médicaments basées sur votre historique, soumises à l'approbation du médecin.",
  },
  {
    id: "ai_drug_interactions",
    label: "Vérification d'interactions médicamenteuses",
    description: "Analyse automatisée de vos médicaments pour détecter des interactions.",
  },
];

function ProcessingPreferencesCard() {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function objectTo(activityId: string) {
    setLoading(activityId);
    setMessage(null);
    try {
      const res = await fetch("/api/patient/restrict-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "objection",
          reason: `Patient objected to ${activityId} via privacy settings`,
          processingActivities: [activityId],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Erreur lors de l'enregistrement." });
      } else {
        setMessage({ type: "success", text: "Opposition enregistrée avec succès." });
      }
    } catch (err) {
      logger.error("Failed to submit objection", { context: "patient-settings", error: err });
      setMessage({ type: "error", text: "Erreur réseau. Veuillez réessayer." });
    } finally {
      setLoading(null);
    }
  }

  async function withdrawObjection(activityId: string) {
    setLoading(activityId);
    setMessage(null);
    try {
      const res = await fetch("/api/patient/restrict-processing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "objection", reason: `Withdrew objection to ${activityId}` }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Erreur." });
      } else {
        setMessage({ type: "success", text: "Opposition retirée." });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur réseau." });
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellOff className="h-5 w-5" />
          Mes préférences de traitement (Art. 21 RGPD)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Vous pouvez vous opposer à certains traitements fondés sur l&apos;intérêt légitime (Art.
          6(1)(f) RGPD). Votre médecin et le personnel soignant conservent toujours l&apos;accès à
          votre dossier médical pour assurer votre prise en charge.
        </p>
        {message && (
          <div
            className={`rounded-md px-4 py-3 text-sm ${message.type === "success" ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200" : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"}`}
          >
            {message.text}
          </div>
        )}
        <div className="space-y-3">
          {PROCESSING_ACTIVITIES.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start justify-between gap-4 rounded-lg border p-3"
            >
              <div>
                <p className="text-sm font-medium">{activity.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading === activity.id}
                  onClick={() => objectTo(activity.id)}
                >
                  <Lock className="h-3 w-3 mr-1" />
                  Refuser
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={loading === activity.id}
                  onClick={() => withdrawObjection(activity.id)}
                >
                  Autoriser
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Pour une restriction complète de tout traitement non essentiel (Art. 18 RGPD), contactez
          notre DPO via la politique de confidentialité.
        </p>
      </CardContent>
    </Card>
  );
}

export default function PatientSettingsPage() {
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleExport(format: "json" | "csv") {
    setExportLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/patient/export?format=${format}`);
      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? "Export failed" });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-data-${getLocalDateStr()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: "success", text: "Vos données ont été téléchargées." });
    } catch (err) {
      logger.warn("Data export failed", { context: "patient-settings", error: err });
      setMessage({ type: "error", text: "Erreur lors de l'export." });
    } finally {
      setExportLoading(false);
    }
  }

  async function handleDeleteRequest() {
    if (
      !confirm(
        "Êtes-vous sûr de vouloir supprimer votre compte ? Vous aurez 30 jours pour annuler cette action.",
      )
    ) {
      return;
    }

    setDeleteLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/patient/delete-account", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setDeleteRequested(true);
        setMessage({
          type: "success",
          text: `Demande de suppression enregistrée. Vos données seront supprimées le ${new Date(data.permanentDeletionAt).toLocaleDateString("fr-FR")}.`,
        });
      } else {
        setMessage({ type: "error", text: data.error ?? "Échec de la demande." });
      }
    } catch (err) {
      logger.warn("Account deletion request failed", { context: "patient-settings", error: err });
      setMessage({ type: "error", text: "Erreur de connexion." });
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleCancelDelete() {
    setDeleteLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/patient/delete-account", { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        setDeleteRequested(false);
        setMessage({ type: "success", text: data.message });
      } else {
        setMessage({ type: "error", text: data.error ?? "Échec de l'annulation." });
      }
    } catch (err) {
      logger.warn("Cancel deletion failed", { context: "patient-settings", error: err });
      setMessage({ type: "error", text: "Erreur de connexion." });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Patient", href: "/patient/dashboard" }, { label: "Settings" }]}
      />
      <div>
        <h1 className="text-2xl font-bold">Paramètres & Confidentialité</h1>
        <p className="text-muted-foreground mt-1">
          Gérez vos données personnelles conformément au RGPD et à la Loi 09-08.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exporter mes données
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Conformément au RGPD (droit à la portabilité), vous pouvez télécharger l&apos;ensemble
            de vos données personnelles à tout moment. Cela inclut vos rendez-vous, ordonnances,
            paiements et documents.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => handleExport("json")} disabled={exportLoading}>
              <Download className="h-4 w-4 mr-2" />
              {exportLoading ? "Export..." : "Exporter en JSON"}
            </Button>
            <Button variant="outline" onClick={() => handleExport("csv")} disabled={exportLoading}>
              <Download className="h-4 w-4 mr-2" />
              {exportLoading ? "Export..." : "Exporter en CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Vos droits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              <strong>Droit d&apos;accès :</strong> vous pouvez consulter toutes vos données depuis
              votre portail patient.
            </li>
            <li>
              <strong>Droit de rectification :</strong> contactez votre cabinet pour corriger des
              informations inexactes.
            </li>
            <li>
              <strong>Droit à la portabilité :</strong> exportez vos données en JSON ou CSV
              ci-dessus.
            </li>
            <li>
              <strong>Droit à l&apos;effacement :</strong> demandez la suppression de votre compte
              ci-dessous.
            </li>
          </ul>
          <div className="mt-4">
            <a href="/privacy" className="text-sm text-primary hover:underline">
              Consulter la politique de confidentialité complète
            </a>
          </div>
        </CardContent>
      </Card>

      {/*
        A69-F3 / A62-F2: GDPR Art.21 — per-category processing objection UI.
        Patients can object to specific processing activities under Art.6(1)(f)
        (legitimate interest) without requesting full account deletion.
      */}
      <ProcessingPreferencesCard />

      {/* Account Deletion */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Supprimer mon compte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 mb-4 dark:border-yellow-800 dark:bg-yellow-950">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              La suppression de votre compte est irréversible après le délai de grâce de 30 jours.
              Toutes vos données (rendez-vous, ordonnances, documents) seront définitivement
              supprimées.
            </p>
          </div>

          {deleteRequested ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Une demande de suppression est en cours. Vous pouvez annuler cette demande pendant
                le délai de grâce de 30 jours.
              </p>
              <Button variant="outline" onClick={handleCancelDelete} disabled={deleteLoading}>
                {deleteLoading ? "Annulation..." : "Annuler la suppression"}
              </Button>
            </div>
          ) : (
            <Button variant="destructive" onClick={handleDeleteRequest} disabled={deleteLoading}>
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteLoading ? "Traitement..." : "Demander la suppression"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
