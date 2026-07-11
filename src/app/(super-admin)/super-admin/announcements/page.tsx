"use client";

import {
  Plus,
  Edit,
  Trash2,
  Megaphone,
  AlertTriangle,
  Info,
  AlertCircle,
  Calendar,
  Users,
  Search,
  Eye,
  Archive,
  Clock,
  Send,
  Sparkles,
  Wrench,
  Bell,
  ServerCrash,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { logger } from "@/lib/logger";
import {
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  setAnnouncementActive,
  deleteAnnouncement,
  type Announcement,
} from "@/lib/super-admin-actions";
import { getLocalDateStr, formatDisplayDate } from "@/lib/utils";

type TypeFilter = "all" | "info" | "warning" | "critical";
type StatusFilter = "all" | "active" | "expired" | "scheduled";
type ScheduleMode = "now" | "later";

const EXAMPLE_TYPES = [
  {
    icon: ServerCrash,
    label: "Mise à jour système",
    description: "Informer les cliniques des changements de la plateforme",
  },
  {
    icon: Wrench,
    label: "Fenêtre de maintenance",
    description: "Planifier des alertes d'indisponibilité",
  },
  {
    icon: Sparkles,
    label: "Nouvelle fonctionnalité",
    description: "Annoncer de nouvelles capacités",
  },
  { icon: Bell, label: "Avis général", description: "Partager une information importante" },
];

const PRIORITY_CONFIG = {
  info: {
    label: "Info",
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    badge: "secondary" as const,
  },
  warning: {
    label: "Avertissement",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    badge: "warning" as const,
  },
  critical: {
    label: "Critique",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    badge: "destructive" as const,
  },
};

export default function AnnouncementsPage() {
  const { addToast } = useToast();
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAnnouncements = useCallback(async () => {
    try {
      const data = await fetchAnnouncements();
      setList(data);
    } catch (err) {
      logger.warn("Failed to load announcements page", { context: "page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const controller = new AbortController();

    timeouts.push(
      setTimeout(() => {
        loadAnnouncements();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));

      (() => {
        controller.abort();
      })();
    };
  }, [loadAnnouncements]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Announcement | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Announcement | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<Announcement | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formType, setFormType] = useState<"info" | "warning" | "critical">("info");
  const [formTarget, setFormTarget] = useState("all");
  const [formExpires, setFormExpires] = useState("");
  const [formScheduleMode, setFormScheduleMode] = useState<ScheduleMode>("now");
  const [formScheduleDate, setFormScheduleDate] = useState("");
  const [showFormPreview, setShowFormPreview] = useState(false);

  const getAnnouncementStatus = useCallback(
    (item: Announcement): "active" | "expired" | "scheduled" => {
      const now = new Date();
      if (item.expiresAt && new Date(item.expiresAt) < now) return "expired";
      if (!item.active) return "expired";
      return "active";
    },
    [],
  );

  const filtered = useMemo(() => {
    return list.filter((a) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q || a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q);
      const matchType = typeFilter === "all" || a.type === typeFilter;
      const matchStatus = statusFilter === "all" || getAnnouncementStatus(a) === statusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [list, search, typeFilter, statusFilter, getAnnouncementStatus]);

  const typeIcon = (type: string) => {
    switch (type) {
      case "info":
        return <Info className="h-4 w-4 text-blue-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case "critical":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  function openCreate() {
    setEditItem(null);
    setFormTitle("");
    setFormMessage("");
    setFormType("info");
    setFormTarget("all");
    setFormExpires("");
    setFormScheduleMode("now");
    setFormScheduleDate("");
    setShowFormPreview(false);
    setEditOpen(true);
  }

  function openEdit(item: Announcement) {
    setEditItem(item);
    setFormTitle(item.title);
    setFormMessage(item.message);
    setFormType(item.type);
    setFormTarget(item.target);
    setFormExpires(item.expiresAt || "");
    setFormScheduleMode("now");
    setFormScheduleDate("");
    setShowFormPreview(false);
    setEditOpen(true);
  }

  async function handleSave() {
    const targetLabels: Record<string, string> = {
      all: "Toutes les cliniques",
      basic: "Offre Basique",
      standard: "Offre Standard",
      premium: "Offre Premium",
    };
    if (!formTitle.trim() || !formMessage.trim()) {
      addToast("Le titre et le message sont obligatoires", "error");
      return;
    }
    const payload = {
      title: formTitle.trim(),
      message: formMessage.trim(),
      type: formType,
      target: formTarget,
      targetLabel: targetLabels[formTarget] || formTarget,
      expiresAt: formExpires || undefined,
    };
    try {
      if (editItem) {
        const updated = await updateAnnouncement(editItem.id, payload);
        setList((prev) => prev.map((a) => (a.id === editItem.id ? updated : a)));
        addToast("Annonce mise à jour", "success");
      } else {
        const created = await createAnnouncement({
          ...payload,
          publishedAt:
            formScheduleMode === "later" && formScheduleDate ? formScheduleDate : getLocalDateStr(),
        });
        setList((prev) => [created, ...prev]);
        addToast(formScheduleMode === "later" ? "Annonce planifiée" : "Annonce publiée", "success");
      }
      setEditOpen(false);
    } catch (err) {
      logger.warn("Failed to save announcement", { context: "page", error: err });
      addToast(
        err instanceof Error ? err.message : "Échec de l'enregistrement de l'annonce",
        "error",
      );
    }
  }

  async function handleDelete() {
    if (!deleteItem) {
      setDeleteOpen(false);
      return;
    }
    const target = deleteItem;
    const previous = list;
    setList((prev) => prev.filter((a) => a.id !== target.id));
    setDeleteOpen(false);
    setDeleteItem(null);
    try {
      await deleteAnnouncement(target.id);
      addToast("Annonce supprimée", "success");
    } catch (err) {
      setList(previous);
      logger.warn("Failed to delete announcement", { context: "page", error: err });
      addToast(
        err instanceof Error ? err.message : "Échec de la suppression de l'annonce",
        "error",
      );
    }
  }

  async function toggleActive(item: Announcement) {
    const previous = list;
    const next = !item.active;
    setList((prev) => prev.map((a) => (a.id === item.id ? { ...a, active: next } : a)));
    try {
      await setAnnouncementActive(item.id, next);
      addToast(next ? "Annonce activée" : "Annonce archivée", "success");
    } catch (err) {
      setList(previous);
      logger.warn("Failed to toggle announcement", { context: "page", error: err });
      addToast(
        err instanceof Error ? err.message : "Échec de la mise à jour de l'annonce",
        "error",
      );
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Annonces" }]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Annonces système</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les annonces visibles par les propriétaires de cliniques
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Nouvelle annonce
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total</p>
            <p className="text-2xl font-bold">{list.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Actives</p>
            <p className="text-2xl font-bold text-green-600">
              {list.filter((a) => a.active).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Critiques</p>
            <p className="text-2xl font-bold text-red-600">
              {list.filter((a) => a.type === "critical").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Expirées</p>
            <p className="text-2xl font-bold text-gray-400">
              {list.filter((a) => a.expiresAt && new Date(a.expiresAt) < new Date()).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher des annonces…"
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          {(["all", "info", "warning", "critical"] as TypeFilter[]).map((t) => (
            <Button
              key={t}
              variant={typeFilter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(t)}
              className="text-xs"
            >
              {t === "all" ? "Tous les types" : PRIORITY_CONFIG[t].label}
            </Button>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-1 mb-4">
        {(["all", "active", "expired", "scheduled"] as StatusFilter[]).map((s) => {
          const STATUS_LABELS: Record<StatusFilter, string> = {
            all: "Tous les statuts",
            active: "Actives",
            expired: "Expirées",
            scheduled: "Planifiées",
          };
          return (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="text-xs"
            >
              {STATUS_LABELS[s]}
            </Button>
          );
        })}
      </div>

      {/* Announcements List */}
      <div className="space-y-3">
        {filtered.map((item) => {
          const status = getAnnouncementStatus(item);
          return (
            <Card key={item.id} className={status === "expired" ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {typeIcon(item.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-sm truncate">{item.title}</h3>
                        <Badge variant={PRIORITY_CONFIG[item.type].badge} className="text-[10px]">
                          {PRIORITY_CONFIG[item.type].label}
                        </Badge>
                        {status === "expired" && (
                          <Badge variant="outline" className="text-[10px]">
                            Expirée
                          </Badge>
                        )}
                        {!item.active && status !== "expired" && (
                          <Badge variant="outline" className="text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.message}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {item.targetLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDisplayDate(item.publishedAt, "fr", "short")}
                        </span>
                        {item.expiresAt && (
                          <span>Expire : {formatDisplayDate(item.expiresAt, "fr", "short")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Aperçu"
                      onClick={() => {
                        setPreviewItem(item);
                        setPreviewOpen(true);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Modifier"
                      onClick={() => openEdit(item)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title={item.active ? "Archiver" : "Activer"}
                      onClick={() => toggleActive(item)}
                    >
                      {item.active ? (
                        <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Megaphone className="h-3.5 w-3.5 text-green-600" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Supprimer"
                      className="text-red-500"
                      onClick={() => {
                        setDeleteItem(item);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Enhanced Empty State */}
        {filtered.length === 0 && list.length === 0 && (
          <div className="py-8">
            <EmptyState
              icon={Megaphone}
              title="Aucune annonce pour le moment"
              description="Créez des annonces pour informer les propriétaires de cliniques des mises à jour système, fenêtres de maintenance, nouvelles fonctionnalités et avis importants."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  Créer votre première annonce
                </Button>
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 max-w-3xl mx-auto">
              {EXAMPLE_TYPES.map((example) => (
                <Card
                  key={example.label}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={openCreate}
                >
                  <CardContent className="p-4 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mx-auto mb-2">
                      <example.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">{example.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{example.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && list.length > 0 && (
          <EmptyState
            icon={Search}
            title="Aucune annonce correspondante"
            description="Essayez d'ajuster votre recherche ou vos filtres pour trouver ce que vous cherchez."
          />
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClose={() => setEditOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Modifier l'annonce" : "Nouvelle annonce"}</DialogTitle>
            <DialogDescription>
              {editItem
                ? "Modifier les détails de l'annonce."
                : "Créer une nouvelle annonce système pour les propriétaires de cliniques."}
            </DialogDescription>
          </DialogHeader>

          {!showFormPreview ? (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input
                  placeholder="Titre de l'annonce"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  placeholder="Rédigez le message de l'annonce…"
                  className="min-h-[100px]"
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priorité</Label>
                  <Select
                    value={formType}
                    onValueChange={(v) => setFormType(v as "info" | "warning" | "critical")}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder="Sélectionner une priorité"
                        value={PRIORITY_CONFIG[formType].label}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          Info
                        </span>
                      </SelectItem>
                      <SelectItem value="warning">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          Avertissement
                        </span>
                      </SelectItem>
                      <SelectItem value="critical">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          Critique
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Public cible</Label>
                  <Select value={formTarget} onValueChange={setFormTarget}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder="Sélectionner un public"
                        value={
                          formTarget === "all"
                            ? "Toutes les cliniques"
                            : formTarget === "basic"
                              ? "Offre Basique"
                              : formTarget === "standard"
                                ? "Offre Standard"
                                : "Offre Premium"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les cliniques</SelectItem>
                      <SelectItem value="basic">Offre Basique</SelectItem>
                      <SelectItem value="standard">Offre Standard</SelectItem>
                      <SelectItem value="premium">Offre Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Programmation</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={formScheduleMode === "now" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormScheduleMode("now")}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Envoyer maintenant
                  </Button>
                  <Button
                    type="button"
                    variant={formScheduleMode === "later" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormScheduleMode("later")}
                  >
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    Planifier
                  </Button>
                </div>
                {formScheduleMode === "later" && (
                  <Input
                    type="datetime-local"
                    value={formScheduleDate}
                    onChange={(e) => setFormScheduleDate(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Date d&apos;expiration (facultatif)</Label>
                <Input
                  type="date"
                  value={formExpires}
                  onChange={(e) => setFormExpires(e.target.value)}
                />
                {formExpires && (
                  <p className="text-xs text-muted-foreground">
                    Expire le {formatDisplayDate(formExpires, "fr", "short")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-4">
              <p className="text-xs text-muted-foreground mb-3">
                Voici comment les cliniques verront l&apos;annonce :
              </p>
              <div className={`rounded-lg p-4 border ${PRIORITY_CONFIG[formType].bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  {typeIcon(formType)}
                  <h3 className="font-semibold text-sm">{formTitle || "Sans titre"}</h3>
                  <Badge variant={PRIORITY_CONFIG[formType].badge} className="text-[10px]">
                    {PRIORITY_CONFIG[formType].label}
                  </Badge>
                </div>
                <p className="text-sm">{formMessage || "Aucun message fourni."}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {formTarget === "all" ? "Toutes les cliniques" : `Offre ${formTarget}`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formScheduleMode === "later" && formScheduleDate
                      ? `Planifiée : ${formScheduleDate}`
                      : "Immédiate"}
                  </span>
                  {formExpires && (
                    <span>Expire : {formatDisplayDate(formExpires, "fr", "short")}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <div className="flex w-full items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowFormPreview(!showFormPreview)}
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                {showFormPreview ? "Retour à l'édition" : "Aperçu"}
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={!formTitle || !formMessage}>
                  {editItem
                    ? "Mettre à jour"
                    : formScheduleMode === "later"
                      ? "Planifier"
                      : "Publier"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        {previewItem && (
          <DialogContent onClose={() => setPreviewOpen(false)} className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {typeIcon(previewItem.type)} {previewItem.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className={`rounded-lg p-4 border ${PRIORITY_CONFIG[previewItem.type].bg}`}>
                <p className="text-sm">{previewItem.message}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Cible : {previewItem.targetLabel}</span>
                <span>Publiée : {formatDisplayDate(previewItem.publishedAt, "fr", "short")}</span>
                {previewItem.expiresAt && (
                  <span>Expire : {formatDisplayDate(previewItem.expiresAt, "fr", "short")}</span>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                Fermer
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
              <DialogTitle>Supprimer l&apos;annonce</DialogTitle>
              <DialogDescription>
                Voulez-vous vraiment supprimer cette annonce ? Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium">{deleteItem.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {PRIORITY_CONFIG[deleteItem.type].label} &middot; {deleteItem.targetLabel}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
