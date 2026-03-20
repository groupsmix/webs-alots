"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Edit, Trash2, Megaphone, AlertTriangle, Info, AlertCircle,
  Calendar, Users, Search, Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import {
  fetchAnnouncements,
  type Announcement,
} from "@/lib/super-admin-actions";

type TypeFilter = "all" | "info" | "warning" | "critical";

export default function AnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAnnouncements = useCallback(async () => {
    try {
      const data = await fetchAnnouncements();
      setList(data);
    } catch (err) {
      console.error("[sa-announcements] failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
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

  const filtered = list.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q);
    return matchSearch && (typeFilter === "all" || a.type === typeFilter);
  });

  const typeIcon = (type: string) => {
    switch (type) {
      case "info": return <Info className="h-4 w-4 text-blue-600" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "critical": return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  function openCreate() {
    setEditItem(null);
    setFormTitle("");
    setFormMessage("");
    setFormType("info");
    setFormTarget("all");
    setFormExpires("");
    setEditOpen(true);
  }

  function openEdit(item: Announcement) {
    setEditItem(item);
    setFormTitle(item.title);
    setFormMessage(item.message);
    setFormType(item.type);
    setFormTarget(item.target);
    setFormExpires(item.expiresAt || "");
    setEditOpen(true);
  }

  function handleSave() {
    const targetLabels: Record<string, string> = {
      all: "All Clinics",
      basic: "Basic Plan",
      standard: "Standard Plan",
      premium: "Premium Plan",
    };
    if (editItem) {
      setList((prev) =>
        prev.map((a) =>
          a.id === editItem.id
            ? { ...a, title: formTitle, message: formMessage, type: formType, target: formTarget, targetLabel: targetLabels[formTarget] || formTarget, expiresAt: formExpires || undefined }
            : a
        )
      );
    } else {
      const newItem: Announcement = {
        id: `ann-${Date.now()}`,
        title: formTitle,
        message: formMessage,
        type: formType,
        target: formTarget,
        targetLabel: targetLabels[formTarget] || formTarget,
        publishedAt: new Date().toISOString().split("T")[0],
        expiresAt: formExpires || undefined,
        active: true,
        createdBy: "Super Admin",
      };
      setList((prev) => [newItem, ...prev]);
    }
    setEditOpen(false);
  }

  function handleDelete() {
    if (deleteItem) {
      setList((prev) => prev.filter((a) => a.id !== deleteItem.id));
    }
    setDeleteOpen(false);
    setDeleteItem(null);
  }

  function toggleActive(item: Announcement) {
    setList((prev) => prev.map((a) => a.id === item.id ? { ...a, active: !a.active } : a));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">System Announcements</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage announcements visible to clinic owners</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          New Announcement
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total</p><p className="text-2xl font-bold">{list.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Active</p><p className="text-2xl font-bold text-green-600">{list.filter((a) => a.active).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Critical</p><p className="text-2xl font-bold text-red-600">{list.filter((a) => a.type === "critical").length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Expired</p><p className="text-2xl font-bold text-gray-400">{list.filter((a) => a.expiresAt && new Date(a.expiresAt) < new Date()).length}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search announcements..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1">
          {(["all", "info", "warning", "critical"] as TypeFilter[]).map((t) => (
            <Button key={t} variant={typeFilter === t ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(t)} className="capitalize text-xs">
              {t === "all" ? "All Types" : t}
            </Button>
          ))}
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-3">
        {filtered.map((item) => (
          <Card key={item.id} className={!item.active ? "opacity-60" : ""}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {typeIcon(item.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm truncate">{item.title}</h3>
                      <Badge variant={item.type === "critical" ? "destructive" : item.type === "warning" ? "warning" : "secondary"} className="text-[10px]">{item.type}</Badge>
                      {!item.active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{item.targetLabel}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{item.publishedAt}</span>
                      {item.expiresAt && <span>Expires: {item.expiresAt}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" title="Preview" onClick={() => { setPreviewItem(item); setPreviewOpen(true); }}><Eye className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" title="Edit" onClick={() => openEdit(item)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" title={item.active ? "Deactivate" : "Activate"} onClick={() => toggleActive(item)}>
                    <Megaphone className={`h-3.5 w-3.5 ${item.active ? "text-green-600" : "text-gray-400"}`} />
                  </Button>
                  <Button variant="ghost" size="sm" title="Delete" className="text-red-500" onClick={() => { setDeleteItem(item); setDeleteOpen(true); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No announcements found.</p>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClose={() => setEditOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Announcement" : "New Announcement"}</DialogTitle>
            <DialogDescription>{editItem ? "Update the announcement details." : "Create a new system announcement for clinic owners."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="Announcement title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <textarea className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Write the announcement message..." value={formMessage} onChange={(e) => setFormMessage(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formType} onChange={(e) => setFormType(e.target.value as "info" | "warning" | "critical")}>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formTarget} onChange={(e) => setFormTarget(e.target.value)}>
                  <option value="all">All Clinics</option>
                  <option value="basic">Basic Plan</option>
                  <option value="standard">Standard Plan</option>
                  <option value="premium">Premium Plan</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Expiry Date (optional)</Label>
              <Input type="date" value={formExpires} onChange={(e) => setFormExpires(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formTitle || !formMessage}>
              {editItem ? "Update" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        {previewItem && (
          <DialogContent onClose={() => setPreviewOpen(false)} className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">{typeIcon(previewItem.type)} {previewItem.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className={`rounded-lg p-4 ${previewItem.type === "critical" ? "bg-red-50 border border-red-200" : previewItem.type === "warning" ? "bg-yellow-50 border border-yellow-200" : "bg-blue-50 border border-blue-200"}`}>
                <p className="text-sm">{previewItem.message}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Target: {previewItem.targetLabel}</span>
                <span>Published: {previewItem.publishedAt}</span>
                {previewItem.expiresAt && <span>Expires: {previewItem.expiresAt}</span>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
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
              <DialogDescription>Are you sure you want to delete this announcement? This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium">{deleteItem.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{deleteItem.type} &middot; {deleteItem.targetLabel}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
