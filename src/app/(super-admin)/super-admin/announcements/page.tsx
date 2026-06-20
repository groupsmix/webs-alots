/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
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
import { getLocalDateStr } from "@/lib/utils";

type TypeFilter = "all" | "info" | "warning" | "critical";
type StatusFilter = "all" | "active" | "expired" | "scheduled";
type ScheduleMode = "now" | "later";

const EXAMPLE_TYPES = [
  {
    icon: ServerCrash,
    label: "System Update",
    description: "Notify clinics about platform changes",
  },
  { icon: Wrench, label: "Maintenance Window", description: "Schedule downtime alerts" },
  { icon: Sparkles, label: "New Feature", description: "Announce new capabilities" },
  { icon: Bell, label: "General Notice", description: "Share important information" },
];

const PRIORITY_CONFIG = {
  info: {
    label: "Info",
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    badge: "secondary" as const,
  },
  warning: {
    label: "Warning",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    badge: "warning" as const,
  },
  critical: {
    label: "Critical",
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
    const controller = new AbortController();
    loadAnnouncements();
    return () => {
      controller.abort();
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
      all: "All Clinics",
      basic: "Basic Plan",
      standard: "Standard Plan",
      premium: "Premium Plan",
    };
    if (!formTitle.trim() || !formMessage.trim()) {
      addToast("Title and message are required", "error");
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
        addToast("Announcement updated", "success");
      } else {
        const created = await createAnnouncement({
          ...payload,
          publishedAt:
            formScheduleMode === "later" && formScheduleDate ? formScheduleDate : getLocalDateStr(),
        });
        setList((prev) => [created, ...prev]);
        addToast(
          formScheduleMode === "later" ? "Announcement scheduled" : "Announcement published",
          "success",
        );
      }
      setEditOpen(false);
    } catch (err) {
      logger.warn("Failed to save announcement", { context: "page", error: err });
      addToast(err instanceof Error ? err.message : "Failed to save announcement", "error");
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
      addToast("Announcement deleted", "success");
    } catch (err) {
      setList(previous);
      logger.warn("Failed to delete announcement", { context: "page", error: err });
      addToast(err instanceof Error ? err.message : "Failed to delete announcement", "error");
    }
  }

  async function toggleActive(item: Announcement) {
    const previous = list;
    const next = !item.active;
    setList((prev) => prev.map((a) => (a.id === item.id ? { ...a, active: next } : a)));
    try {
      await setAnnouncementActive(item.id, next);
      addToast(next ? "Announcement activated" : "Announcement archived", "success");
    } catch (err) {
      setList(previous);
      logger.warn("Failed to toggle announcement", { context: "page", error: err });
      addToast(err instanceof Error ? err.message : "Failed to update announcement", "error");
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
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Announcements" },
        ]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">System Announcements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage announcements visible to clinic owners
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          New Announcement
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
            <p className="text-xs text-muted-foreground mb-1">Active</p>
            <p className="text-2xl font-bold text-green-600">
              {list.filter((a) => a.active).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Critical</p>
            <p className="text-2xl font-bold text-red-600">
              {list.filter((a) => a.type === "critical").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Expired</p>
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
            placeholder="Search announcements..."
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
              className="capitalize text-xs"
            >
              {t === "all" ? "All Types" : t}
            </Button>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-1 mb-4">
        {(["all", "active", "expired", "scheduled"] as StatusFilter[]).map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
            className="capitalize text-xs"
          >
            {s === "all" ? "All Status" : s}
          </Button>
        ))}
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
                          {item.type}
                        </Badge>
                        {status === "expired" && (
                          <Badge variant="outline" className="text-[10px]">
                            Expired
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
                          {item.publishedAt}
                        </span>
                        {item.expiresAt && <span>Expires: {item.expiresAt}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Preview"
                      onClick={() => {
                        setPreviewItem(item);
                        setPreviewOpen(true);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Edit" onClick={() => openEdit(item)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title={item.active ? "Archive" : "Activate"}
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
                      title="Delete"
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
              title="No announcements yet"
              description="Create announcements to notify clinic owners about system updates, maintenance windows, new features, and important notices."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create your first announcement
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
            title="No matching announcements"
            description="Try adjusting your search or filters to find what you're looking for."
          />
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClose={() => setEditOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Announcement" : "New Announcement"}</DialogTitle>
            <DialogDescription>
              {editItem
                ? "Modifier les détails de l'annonce."
                : "Créer une nouvelle annonce système pour les propriétaires de cliniques."}
            </DialogDescription>
          </DialogHeader>

          {!showFormPreview ? (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder="Announcement title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  placeholder="Write the announcement message..."
                  className="min-h-[100px]"
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={formType}
                    onValueChange={(v) => setFormType(v as "info" | "warning" | "critical")}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder="Select priority"
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
                          Warning
                        </span>
                      </SelectItem>
                      <SelectItem value="critical">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          Critical
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select value={formTarget} onValueChange={setFormTarget}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder="Select audience"
                        value={
                          formTarget === "all"
                            ? "All Clinics"
                            : formTarget === "basic"
                              ? "Basic Plan"
                              : formTarget === "standard"
                                ? "Standard Plan"
                                : "Premium Plan"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clinics</SelectItem>
                      <SelectItem value="basic">Basic Plan</SelectItem>
                      <SelectItem value="standard">Standard Plan</SelectItem>
                      <SelectItem value="premium">Premium Plan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Schedule</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={formScheduleMode === "now" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormScheduleMode("now")}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Send Now
                  </Button>
                  <Button
                    type="button"
                    variant={formScheduleMode === "later" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormScheduleMode("later")}
                  >
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    Schedule
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
                <Label>Expiry Date (optional)</Label>
                <Input
                  type="date"
                  value={formExpires}
                  onChange={(e) => setFormExpires(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="py-4">
              <p className="text-xs text-muted-foreground mb-3">
                This is how clinics will see the announcement:
              </p>
              <div className={`rounded-lg p-4 border ${PRIORITY_CONFIG[formType].bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  {typeIcon(formType)}
                  <h3 className="font-semibold text-sm">{formTitle || "Untitled"}</h3>
                  <Badge variant={PRIORITY_CONFIG[formType].badge} className="text-[10px]">
                    {formType}
                  </Badge>
                </div>
                <p className="text-sm">{formMessage || "No message provided."}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {formTarget === "all" ? "All Clinics" : `${formTarget} Plan`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formScheduleMode === "later" && formScheduleDate
                      ? `Scheduled: ${formScheduleDate}`
                      : "Immediate"}
                  </span>
                  {formExpires && <span>Expires: {formExpires}</span>}
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
                {showFormPreview ? "Back to Edit" : "Preview"}
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
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
                <span>Target: {previewItem.targetLabel}</span>
                <span>Published: {previewItem.publishedAt}</span>
                {previewItem.expiresAt && <span>Expires: {previewItem.expiresAt}</span>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                Close
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
              <DialogTitle>Delete Announcement</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this announcement? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium">{deleteItem.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {deleteItem.type} &middot; {deleteItem.targetLabel}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
