"use client";

import {
  Edit,
  Trash2,
  Copy,
  Eye,
  Search,
  Filter,
  FileText,
  FileSpreadsheet,
  FileCheck,
  FilePlus,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import { logger } from "@/lib/logger";
import { formatNumber, formatDisplayDate } from "@/lib/utils";

interface Template {
  id: string;
  name: string;
  description: string;
  type: "prescription" | "invoice" | "report" | "certificate" | "consent" | "letter";
  clinic_type: "all" | "doctor" | "dentist" | "pharmacy";
  content: string;
  created_at: string;
  updated_at: string;
  usage_count: number;
  is_active: boolean;
}

type TypeFilter = "all" | Template["type"];
type ClinicTypeFilter = "all" | "doctor" | "dentist" | "pharmacy";

const TYPE_LABELS: Record<Template["type"], string> = {
  prescription: "Ordonnance",
  invoice: "Facture",
  report: "Rapport",
  certificate: "Certificat",
  consent: "Consentement",
  letter: "Lettre",
};

const CLINIC_TYPE_LABELS: Record<string, string> = {
  all: "Toutes les cliniques",
  doctor: "Médecin",
  dentist: "Dentiste",
  pharmacy: "Pharmacie",
};

export default function TemplateManagerPage() {
  const [locale] = useLocale();
  const { addToast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [clinicTypeFilter, setClinicTypeFilter] = useState<ClinicTypeFilter>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<Template | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<Template["type"]>("prescription");
  const [formClinicType, setFormClinicType] = useState<Template["clinic_type"]>("all");
  const [formContent, setFormContent] = useState("");

  const loadTemplates = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/super-admin/templates");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `${res.status}`);
      setTemplates(json.data.templates ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Échec du chargement des modèles");
      logger.warn("Failed to load document templates", { error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        void loadTemplates();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [loadTemplates]);

  const filtered = templates.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q || t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q);
    return (
      matchSearch &&
      (typeFilter === "all" || t.type === typeFilter) &&
      (clinicTypeFilter === "all" || t.clinic_type === clinicTypeFilter || t.clinic_type === "all")
    );
  });

  const typeIcon = (type: string) => {
    switch (type) {
      case "prescription":
        return <FileText className="h-4 w-4 text-blue-600" />;
      case "invoice":
        return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
      case "report":
        return <FileCheck className="h-4 w-4 text-purple-600" />;
      case "certificate":
        return <FileText className="h-4 w-4 text-orange-600" />;
      case "consent":
        return <FileCheck className="h-4 w-4 text-red-600" />;
      case "letter":
        return <FileText className="h-4 w-4 text-teal-600" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  function openCreate() {
    setEditItem(null);
    setFormName("");
    setFormDesc("");
    setFormType("prescription");
    setFormClinicType("all");
    setFormContent("");
    setEditOpen(true);
  }

  function openEdit(item: Template) {
    setEditItem(item);
    setFormName(item.name);
    setFormDesc(item.description ?? "");
    setFormType(item.type);
    setFormClinicType(item.clinic_type);
    setFormContent(item.content);
    setEditOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formContent.trim()) return;
    setSaving(true);
    try {
      if (editItem) {
        const res = await fetch("/api/super-admin/templates", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editItem.id,
            name: formName,
            description: formDesc,
            type: formType,
            clinicType: formClinicType,
            content: formContent,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `${res.status}`);
        setTemplates((prev) => prev.map((t) => (t.id === editItem.id ? json.data.template : t)));
        addToast("Modèle mis à jour", "success");
      } else {
        const res = await fetch("/api/super-admin/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            description: formDesc,
            type: formType,
            clinicType: formClinicType,
            content: formContent,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `${res.status}`);
        setTemplates((prev) => [json.data.template, ...prev]);
        addToast("Modèle créé", "success");
      }
      setEditOpen(false);
    } catch (err) {
      logger.warn("Failed to save template", { error: err });
      addToast("Échec de l'enregistrement du modèle. Veuillez réessayer.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(item: Template) {
    try {
      const res = await fetch("/api/super-admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${item.name} (Copy)`,
          description: item.description ?? "",
          type: item.type,
          clinicType: item.clinic_type,
          content: item.content,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `${res.status}`);
      setTemplates((prev) => [json.data.template, ...prev]);
      addToast(`« ${item.name} » dupliqué`, "success");
    } catch (err) {
      logger.warn("Failed to duplicate template", { error: err });
      addToast("Échec de la duplication du modèle.", "error");
    }
  }

  async function handleDelete() {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/super-admin/templates?id=${deleteItem.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteItem.id));
      addToast("Modèle supprimé", "success");
    } catch (err) {
      logger.warn("Failed to delete template", { error: err });
      addToast("Échec de la suppression du modèle.", "error");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
      setDeleteItem(null);
    }
  }

  async function toggleActive(item: Template) {
    const previous = templates;
    setTemplates((prev) =>
      prev.map((t) => (t.id === item.id ? { ...t, is_active: !t.is_active } : t)),
    );
    try {
      const res = await fetch("/api/super-admin/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, active: !item.is_active }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      addToast(item.is_active ? "Modèle désactivé" : "Modèle activé", "success");
    } catch (err) {
      logger.warn("Failed to toggle template", { error: err });
      setTemplates(previous);
      addToast("Échec de la mise à jour du modèle.", "error");
    }
  }

  if (loading) return <PageLoader message="Chargement des modèles…" />;

  if (loadError) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Échec du chargement des modèles.</p>
        <p className="text-sm text-muted-foreground mt-1">{loadError}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            setLoading(true);
            void loadTemplates();
          }}
        >
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Modèles" }]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestion des modèles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les modèles de documents pour tous les types de cliniques
          </p>
        </div>
        <Button onClick={openCreate}>
          <FilePlus className="h-4 w-4 mr-1" />
          Nouveau modèle
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total des modèles</p>
            <p className="text-2xl font-bold">{templates.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Actifs</p>
            <p className="text-2xl font-bold text-green-600">
              {templates.filter((t) => t.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Types de modèles</p>
            <p className="text-2xl font-bold">6</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Utilisation totale</p>
            <p className="text-2xl font-bold">
              {formatNumber(
                templates.reduce((s, t) => s + t.usage_count, 0),
                locale ?? "fr",
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher des modèles…"
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(["all", "doctor", "dentist", "pharmacy"] as ClinicTypeFilter[]).map((ct) => (
              <Button
                key={ct}
                variant={clinicTypeFilter === ct ? "default" : "outline"}
                size="sm"
                onClick={() => setClinicTypeFilter(ct)}
                className="text-xs"
              >
                {CLINIC_TYPE_LABELS[ct] ?? ct}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              "all",
              "prescription",
              "invoice",
              "report",
              "certificate",
              "consent",
              "letter",
            ] as TypeFilter[]
          ).map((t) => (
            <Button
              key={t}
              variant={typeFilter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(t)}
              className="text-xs"
            >
              {t === "all" ? "Tous les types" : TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((tpl) => (
          <Card key={tpl.id} className={!tpl.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {typeIcon(tpl.type)}
                  <CardTitle className="text-sm">{tpl.name}</CardTitle>
                </div>
                {!tpl.is_active && (
                  <Badge variant="outline" className="text-[10px]">
                    Inactif
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{tpl.description}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {TYPE_LABELS[tpl.type] ?? tpl.type}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {CLINIC_TYPE_LABELS[tpl.clinic_type] ?? tpl.clinic_type}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Utilisé {formatNumber(tpl.usage_count, locale ?? "fr")} fois</span>
                <span>Mis à jour {formatDisplayDate(tpl.updated_at, locale ?? "fr", "short")}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Aperçu"
                    onClick={() => {
                      setPreviewItem(tpl);
                      setPreviewOpen(true);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" title="Modifier" onClick={() => openEdit(tpl)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Dupliquer"
                    onClick={() => handleDuplicate(tpl)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    title={tpl.is_active ? "Désactiver" : "Activer"}
                    className={tpl.is_active ? "text-green-600" : "text-gray-400"}
                    onClick={() => toggleActive(tpl)}
                  >
                    <FileCheck className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Supprimer"
                    className="text-red-500"
                    onClick={() => {
                      setDeleteItem(tpl);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>
              {templates.length === 0
                ? "Aucun modèle pour le moment. Créez votre premier modèle."
                : "Aucun modèle ne correspond à votre filtre."}
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          onClose={() => setEditOpen(false)}
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>{editItem ? "Modifier le modèle" : "Nouveau modèle"}</DialogTitle>
            <DialogDescription>
              {editItem
                ? "Mettez à jour les détails et le contenu du modèle."
                : "Créez un nouveau modèle de document."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom du modèle</Label>
                <Input
                  placeholder="ex. Ordonnance standard"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Type de document</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as Template["type"])}
                >
                  <option value="prescription">Ordonnance</option>
                  <option value="invoice">Facture</option>
                  <option value="report">Rapport</option>
                  <option value="certificate">Certificat</option>
                  <option value="consent">Consentement</option>
                  <option value="letter">Lettre</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Brève description"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Type de clinique</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={formClinicType}
                  onChange={(e) => setFormClinicType(e.target.value as Template["clinic_type"])}
                >
                  <option value="all">Tous les types de cliniques</option>
                  <option value="doctor">Médecin</option>
                  <option value="dentist">Dentiste</option>
                  <option value="pharmacy">Pharmacie</option>
                </select>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Contenu du modèle</Label>
              <p className="text-xs text-muted-foreground">
                Utilisez {`{{nom_variable}}`} pour les variables dynamiques.
              </p>
              <textarea
                className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Contenu du modèle avec {{variables}}…"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formName.trim() || !formContent.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {editItem ? "Mettre à jour le modèle" : "Créer le modèle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        {previewItem && (
          <DialogContent onClose={() => setPreviewOpen(false)} className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {typeIcon(previewItem.type)} {previewItem.name}
              </DialogTitle>
              <DialogDescription>{previewItem.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="flex gap-2">
                <Badge variant="secondary">
                  {TYPE_LABELS[previewItem.type] ?? previewItem.type}
                </Badge>
                <Badge variant="outline">
                  {CLINIC_TYPE_LABELS[previewItem.clinic_type] ?? previewItem.clinic_type}
                </Badge>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <pre className="text-sm whitespace-pre-wrap font-mono">{previewItem.content}</pre>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  Créé : {formatDisplayDate(previewItem.created_at, locale ?? "fr", "short")}
                </span>
                <span>
                  Mis à jour : {formatDisplayDate(previewItem.updated_at, locale ?? "fr", "short")}
                </span>
                <span>Utilisé : {formatNumber(previewItem.usage_count, locale ?? "fr")} fois</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                Fermer
              </Button>
              <Button
                onClick={() => {
                  setPreviewOpen(false);
                  openEdit(previewItem);
                }}
              >
                <Edit className="h-4 w-4 mr-1" />
                Modifier
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        {deleteItem && (
          <DialogContent onClose={() => setDeleteOpen(false)}>
            <DialogHeader>
              <DialogTitle>Supprimer le modèle</DialogTitle>
              <DialogDescription>
                Voulez-vous vraiment supprimer ce modèle ? Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium">{deleteItem.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {TYPE_LABELS[deleteItem.type] ?? deleteItem.type} · Utilisé{" "}
                {formatNumber(deleteItem.usage_count, locale ?? "fr")} fois
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
