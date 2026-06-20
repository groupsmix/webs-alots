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
import { formatNumber } from "@/lib/utils";

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
      setLoadError(err instanceof Error ? err.message : "Failed to load templates");
      logger.warn("Failed to load document templates", { error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  const filtered = templates.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q);
    return (
      matchSearch &&
      (typeFilter === "all" || t.type === typeFilter) &&
      (clinicTypeFilter === "all" || t.clinic_type === clinicTypeFilter || t.clinic_type === "all")
    );
  });

  const typeIcon = (type: string) => {
    switch (type) {
      case "prescription": return <FileText className="h-4 w-4 text-blue-600" />;
      case "invoice": return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
      case "report": return <FileCheck className="h-4 w-4 text-purple-600" />;
      case "certificate": return <FileText className="h-4 w-4 text-orange-600" />;
      case "consent": return <FileCheck className="h-4 w-4 text-red-600" />;
      case "letter": return <FileText className="h-4 w-4 text-teal-600" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  function openCreate() {
    setEditItem(null);
    setFormName(""); setFormDesc(""); setFormType("prescription");
    setFormClinicType("all"); setFormContent("");
    setEditOpen(true);
  }

  function openEdit(item: Template) {
    setEditItem(item);
    setFormName(item.name); setFormDesc(item.description ?? "");
    setFormType(item.type); setFormClinicType(item.clinic_type);
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
          body: JSON.stringify({ id: editItem.id, name: formName, description: formDesc, type: formType, clinicType: formClinicType, content: formContent }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `${res.status}`);
        setTemplates((prev) => prev.map((t) => t.id === editItem.id ? json.data.template : t));
        addToast("Template updated", "success");
      } else {
        const res = await fetch("/api/super-admin/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, description: formDesc, type: formType, clinicType: formClinicType, content: formContent }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `${res.status}`);
        setTemplates((prev) => [json.data.template, ...prev]);
        addToast("Template created", "success");
      }
      setEditOpen(false);
    } catch (err) {
      logger.warn("Failed to save template", { error: err });
      addToast("Failed to save template. Please try again.", "error");
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
          name: `${item.name} (Copy)`, description: item.description ?? "",
          type: item.type, clinicType: item.clinic_type, content: item.content,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `${res.status}`);
      setTemplates((prev) => [json.data.template, ...prev]);
      addToast(`"${item.name}" duplicated`, "success");
    } catch (err) {
      logger.warn("Failed to duplicate template", { error: err });
      addToast("Failed to duplicate template.", "error");
    }
  }

  async function handleDelete() {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/super-admin/templates?id=${deleteItem.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`${res.status}`);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteItem.id));
      addToast("Template deleted", "success");
    } catch (err) {
      logger.warn("Failed to delete template", { error: err });
      addToast("Failed to delete template.", "error");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
      setDeleteItem(null);
    }
  }

  async function toggleActive(item: Template) {
    const previous = templates;
    setTemplates((prev) => prev.map((t) => t.id === item.id ? { ...t, is_active: !t.is_active } : t));
    try {
      const res = await fetch("/api/super-admin/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, active: !item.is_active }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      addToast(item.is_active ? "Template deactivated" : "Template activated", "success");
    } catch (err) {
      logger.warn("Failed to toggle template", { error: err });
      setTemplates(previous);
      addToast("Failed to update template.", "error");
    }
  }

  if (loading) return <PageLoader message="Loading templates..." />;

  if (loadError) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load templates.</p>
        <p className="text-sm text-muted-foreground mt-1">{loadError}</p>
        <Button variant="outline" className="mt-4" onClick={() => { setLoading(true); void loadTemplates(); }}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Templates" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Template Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage document templates for all clinic types</p>
        </div>
        <Button onClick={openCreate}>
          <FilePlus className="h-4 w-4 mr-1" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total Templates</p><p className="text-2xl font-bold">{templates.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Active</p><p className="text-2xl font-bold text-green-600">{templates.filter((t) => t.is_active).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Template Types</p><p className="text-2xl font-bold">6</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total Usage</p><p className="text-2xl font-bold">{formatNumber(templates.reduce((s, t) => s + t.usage_count, 0), locale ?? "fr")}</p></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search templates..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(["all", "doctor", "dentist", "pharmacy"] as ClinicTypeFilter[]).map((ct) => (
              <Button key={ct} variant={clinicTypeFilter === ct ? "default" : "outline"} size="sm" onClick={() => setClinicTypeFilter(ct)} className="capitalize text-xs">
                {ct === "all" ? "All Clinics" : ct}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", "prescription", "invoice", "report", "certificate", "consent", "letter"] as TypeFilter[]).map((t) => (
            <Button key={t} variant={typeFilter === t ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(t)} className="capitalize text-xs">
              {t === "all" ? "All Types" : t}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((tpl) => (
          <Card key={tpl.id} className={!tpl.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">{typeIcon(tpl.type)}<CardTitle className="text-sm">{tpl.name}</CardTitle></div>
                {!tpl.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{tpl.description}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-[10px] capitalize">{tpl.type}</Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{tpl.clinic_type === "all" ? "All Clinics" : tpl.clinic_type}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Used {formatNumber(tpl.usage_count, locale ?? "fr")} times</span>
                <span>Updated {tpl.updated_at.slice(0, 10)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" title="Preview" onClick={() => { setPreviewItem(tpl); setPreviewOpen(true); }}><Eye className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" title="Edit" onClick={() => openEdit(tpl)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" title="Duplicate" onClick={() => handleDuplicate(tpl)}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" title={tpl.is_active ? "Deactivate" : "Activate"} className={tpl.is_active ? "text-green-600" : "text-gray-400"} onClick={() => toggleActive(tpl)}>
                    <FileCheck className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" title="Delete" className="text-red-500" onClick={() => { setDeleteItem(tpl); setDeleteOpen(true); }}>
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
            <p>{templates.length === 0 ? "No templates yet. Create your first template." : "No templates match your filter."}</p>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClose={() => setEditOpen(false)} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Template" : "New Template"}</DialogTitle>
            <DialogDescription>{editItem ? "Update template details and content." : "Create a new document template."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Template Name</Label><Input placeholder="e.g. Standard Prescription" value={formName} onChange={(e) => setFormName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Document Type</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formType} onChange={(e) => setFormType(e.target.value as Template["type"])}>
                  <option value="prescription">Prescription</option><option value="invoice">Invoice</option>
                  <option value="report">Report</option><option value="certificate">Certificate</option>
                  <option value="consent">Consent Form</option><option value="letter">Letter</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Description</Label><Input placeholder="Brief description" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} /></div>
              <div className="space-y-2"><Label>Clinic Type</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formClinicType} onChange={(e) => setFormClinicType(e.target.value as Template["clinic_type"])}>
                  <option value="all">All Clinic Types</option><option value="doctor">Doctor</option>
                  <option value="dentist">Dentist</option><option value="pharmacy">Pharmacy</option>
                </select>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Template Content</Label>
              <p className="text-xs text-muted-foreground">Use {`{{variable_name}}`} for dynamic placeholders.</p>
              <textarea
                className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Template content with {{placeholders}}..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim() || !formContent.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {editItem ? "Update Template" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        {previewItem && (
          <DialogContent onClose={() => setPreviewOpen(false)} className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">{typeIcon(previewItem.type)} {previewItem.name}</DialogTitle>
              <DialogDescription>{previewItem.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="flex gap-2">
                <Badge variant="secondary" className="capitalize">{previewItem.type}</Badge>
                <Badge variant="outline" className="capitalize">{previewItem.clinic_type === "all" ? "All Clinics" : previewItem.clinic_type}</Badge>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4"><pre className="text-sm whitespace-pre-wrap font-mono">{previewItem.content}</pre></div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Created: {previewItem.created_at.slice(0, 10)}</span>
                <span>Updated: {previewItem.updated_at.slice(0, 10)}</span>
                <span>Used: {formatNumber(previewItem.usage_count, locale ?? "fr")} times</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
              <Button onClick={() => { setPreviewOpen(false); openEdit(previewItem); }}><Edit className="h-4 w-4 mr-1" />Edit</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        {deleteItem && (
          <DialogContent onClose={() => setDeleteOpen(false)}>
            <DialogHeader>
              <DialogTitle>Delete Template</DialogTitle>
              <DialogDescription>Are you sure you want to delete this template? This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium">{deleteItem.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{deleteItem.type} · Used {formatNumber(deleteItem.usage_count, locale ?? "fr")} times</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
