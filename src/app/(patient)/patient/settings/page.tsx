"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Trash2, ShieldCheck, AlertTriangle } from "lucide-react";
import { logger } from "@/lib/logger";

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
      a.download = `my-data-${new Date().toISOString().split("T")[0]}.${format}`;
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
    if (!confirm("Êtes-vous sûr de vouloir supprimer votre compte ? Vous aurez 30 jours pour annuler cette action.")) {
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
            Conformément au RGPD (droit à la portabilité), vous pouvez
            télécharger l&apos;ensemble de vos données personnelles à tout
            moment. Cela inclut vos rendez-vous, ordonnances, paiements et
            documents.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => handleExport("json")}
              disabled={exportLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              {exportLoading ? "Export..." : "Exporter en JSON"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport("csv")}
              disabled={exportLoading}
            >
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
              <strong>Droit d&apos;accès :</strong> vous pouvez consulter toutes
              vos données depuis votre portail patient.
            </li>
            <li>
              <strong>Droit de rectification :</strong> contactez votre cabinet
              pour corriger des informations inexactes.
            </li>
            <li>
              <strong>Droit à la portabilité :</strong> exportez vos données en
              JSON ou CSV ci-dessus.
            </li>
            <li>
              <strong>Droit à l&apos;effacement :</strong> demandez la
              suppression de votre compte ci-dessous.
            </li>
          </ul>
          <div className="mt-4">
            <a
              href="/privacy"
              className="text-sm text-primary hover:underline"
            >
              Consulter la politique de confidentialité complète
            </a>
          </div>
        </CardContent>
      </Card>

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
              La suppression de votre compte est irréversible après le délai de
              grâce de 30 jours. Toutes vos données (rendez-vous, ordonnances,
              documents) seront définitivement supprimées.
            </p>
          </div>

          {deleteRequested ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Une demande de suppression est en cours. Vous pouvez annuler
                cette demande pendant le délai de grâce de 30 jours.
              </p>
              <Button
                variant="outline"
                onClick={handleCancelDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Annulation..." : "Annuler la suppression"}
              </Button>
            </div>
          ) : (
            <Button
              variant="destructive"
              onClick={handleDeleteRequest}
              disabled={deleteLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteLoading ? "Traitement..." : "Demander la suppression"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
