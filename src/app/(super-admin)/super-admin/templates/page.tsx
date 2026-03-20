"use client";

import { useState } from "react";
import {
  Edit, Trash2, Copy, Eye, Search, Filter,
  FileText, FileSpreadsheet, FileCheck, FilePlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface Template {
  id: string;
  name: string;
  description: string;
  type: "prescription" | "invoice" | "report" | "certificate" | "consent" | "letter";
  clinicType: "all" | "doctor" | "dentist" | "pharmacy";
  content: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  active: boolean;
}

const initialTemplates: Template[] = [
  { id: "tpl-1", name: "Standard Prescription", description: "General prescription template for doctors", type: "prescription", clinicType: "doctor", content: "Patient: {{patient_name}}\nDate: {{date}}\n\nRx:\n{{medications}}\n\nDr. {{doctor_name}}\nLicense: {{license_no}}", createdAt: "2024-01-15", updatedAt: "2024-11-01", usageCount: 1245, active: true },
  { id: "tpl-2", name: "Dental Treatment Plan", description: "Treatment plan template for dental clinics", type: "report", clinicType: "dentist", content: "Patient: {{patient_name}}\nTreatment Plan:\n{{treatment_details}}\n\nEstimated Cost: {{cost}} MAD\nDuration: {{duration}}", createdAt: "2024-02-20", updatedAt: "2024-10-15", usageCount: 890, active: true },
  { id: "tpl-3", name: "Invoice Standard", description: "Standard billing invoice for all clinic types", type: "invoice", clinicType: "all", content: "Invoice #{{invoice_no}}\nDate: {{date}}\nPatient: {{patient_name}}\n\nServices:\n{{services}}\n\nTotal: {{total}} MAD", createdAt: "2024-01-10", updatedAt: "2024-12-01", usageCount: 2340, active: true },
  { id: "tpl-4", name: "Medical Certificate", description: "Medical certificate for work/school absence", type: "certificate", clinicType: "doctor", content: "MEDICAL CERTIFICATE\n\nThis certifies that {{patient_name}} was examined on {{date}} and requires {{days}} days of rest.\n\nDr. {{doctor_name}}", createdAt: "2024-03-05", updatedAt: "2024-09-20", usageCount: 567, active: true },
  { id: "tpl-5", name: "Pharmacy Dispensing Record", description: "Record of medications dispensed", type: "report", clinicType: "pharmacy", content: "Dispensing Record\nDate: {{date}}\nPatient: {{patient_name}}\nPrescription: {{rx_no}}\n\nMedications:\n{{medications}}\n\nPharmacist: {{pharmacist_name}}", createdAt: "2024-04-12", updatedAt: "2024-11-10", usageCount: 1890, active: true },
  { id: "tpl-6", name: "Patient Consent Form", description: "General consent form for procedures", type: "consent", clinicType: "all", content: "CONSENT FORM\n\nI, {{patient_name}}, consent to {{procedure}} as explained by Dr. {{doctor_name}}.\n\nSignature: ___________\nDate: {{date}}", createdAt: "2024-05-01", updatedAt: "2024-08-15", usageCount: 345, active: true },
  { id: "tpl-7", name: "Referral Letter", description: "Referral letter to specialist", type: "letter", clinicType: "doctor", content: "Dear Dr. {{specialist_name}},\n\nI am referring {{patient_name}} for {{reason}}.\n\nHistory: {{medical_history}}\n\nRegards,\nDr. {{doctor_name}}", createdAt: "2024-06-18", updatedAt: "2024-10-30", usageCount: 234, active: true },
  { id: "tpl-8", name: "Dental X-Ray Report", description: "X-ray findings report template", type: "report", clinicType: "dentist", content: "X-RAY REPORT\nPatient: {{patient_name}}\nDate: {{date}}\nType: {{xray_type}}\n\nFindings:\n{{findings}}\n\nRecommendation: {{recommendation}}", createdAt: "2024-07-22", updatedAt: "2024-11-25", usageCount: 456, active: false },
];

type TypeFilter = "all" | "prescription" | "invoice" | "report" | "certificate" | "consent" | "letter";
type ClinicTypeFilter = "all" | "doctor" | "dentist" | "pharmacy";

export default function TemplateManagerPage() {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [clinicTypeFilter, setClinicTypeFilter] = useState<ClinicTypeFilter>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Template | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Template | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<Template | null>(null);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<Template["type"]>("prescription");
  const [formClinicType, setFormClinicType] = useState<Template["clinicType"]>("all");
  const [formContent, setFormContent] = useState("");

  const filtered = templates.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    return matchSearch && (typeFilter === "all" || t.type === typeFilter) && (clinicTypeFilter === "all" || t.clinicType === clinicTypeFilter || t.clinicType === "all");
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
    setFormDesc(item.description);
    setFormType(item.type);
    setFormClinicType(item.clinicType);
    setFormContent(item.content);
    setEditOpen(true);
  }

  function handleSave() {
    if (editItem) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editItem.id
            ? { ...t, name: formName, description: formDesc, type: formType, clinicType: formClinicType, content: formContent, updatedAt: new Date().toISOString().split("T")[0] }
            : t
        )
      );
    } else {
      const newTemplate: Template = {
        id: `tpl-${Date.now()}`,
        name: formName,
        description: formDesc,
        type: formType,
        clinicType: formClinicType,
        content: formContent,
        createdAt: new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0],
        usageCount: 0,
        active: true,
      };
      setTemplates((prev) => [newTemplate, ...prev]);
    }
    setEditOpen(false);
  }

  function handleDuplicate(item: Template) {
    const dup: Template = {
      ...item,
      id: `tpl-${Date.now()}`,
      name: `${item.name} (Copy)`,
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0],
      usageCount: 0,
    };
    setTemplates((prev) => [dup, ...prev]);
  }

  function handleDelete() {
    if (deleteItem) {
      setTemplates((prev) => prev.filter((t) => t.id !== deleteItem.id));
    }
    setDeleteOpen(false);
    setDeleteItem(null);
  }

  function toggleActive(item: Template) {
    setTemplates((prev) => prev.map((t) => t.id === item.id ? { ...t, active: !t.active } : t));
  }

  return (
    <div>
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total Templates</p><p className="text-2xl font-bold">{templates.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Active</p><p className="text-2xl font-bold text-green-600">{templates.filter((t) => t.active).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Template Types</p><p className="text-2xl font-bold">6</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total Usage</p><p className="text-2xl font-bold">{templates.reduce((sum, t) => sum + t.usageCount, 0).toLocaleString()}</p></CardContent></Card>
      </div>

      {/* Filters */}
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

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((tpl) => (
          <Card key={tpl.id} className={!tpl.active ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {typeIcon(tpl.type)}
                  <CardTitle className="text-sm">{tpl.name}</CardTitle>
                </div>
                {!tpl.active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{tpl.description}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-[10px] capitalize">{tpl.type}</Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{tpl.clinicType === "all" ? "All Clinics" : tpl.clinicType}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Used {tpl.usageCount.toLocaleString()} times</span>
                <span>Updated {tpl.updatedAt}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" title="Preview" onClick={() => { setPreviewItem(tpl); setPreviewOpen(true); }}><Eye className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" title="Edit" onClick={() => openEdit(tpl)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" title="Duplicate" onClick={() => handleDuplicate(tpl)}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" title={tpl.active ? "Deactivate" : "Activate"} className={tpl.active ? "text-green-600" : "text-gray-400"} onClick={() => toggleActive(tpl)}>
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
            <p>No templates found.</p>
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
              <div className="space-y-2">
                <Label>Document Type</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formType} onChange={(e) => setFormType(e.target.value as Template["type"])}>
                  <option value="prescription">Prescription</option><option value="invoice">Invoice</option><option value="report">Report</option>
                  <option value="certificate">Certificate</option><option value="consent">Consent Form</option><option value="letter">Letter</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Description</Label><Input placeholder="Brief description" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Clinic Type</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formClinicType} onChange={(e) => setFormClinicType(e.target.value as Template["clinicType"])}>
                  <option value="all">All Clinic Types</option><option value="doctor">Doctor</option><option value="dentist">Dentist</option><option value="pharmacy">Pharmacy</option>
                </select>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Template Content</Label>
              <p className="text-xs text-muted-foreground">Use {"{{variable_name}}"} for dynamic placeholders.</p>
              <textarea className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Template content with {{placeholders}}..." value={formContent} onChange={(e) => setFormContent(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formName || !formContent}>
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
                <Badge variant="outline" className="capitalize">{previewItem.clinicType === "all" ? "All Clinics" : previewItem.clinicType}</Badge>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <pre className="text-sm whitespace-pre-wrap font-mono">{previewItem.content}</pre>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Created: {previewItem.createdAt}</span>
                <span>Updated: {previewItem.updatedAt}</span>
                <span>Used: {previewItem.usageCount.toLocaleString()} times</span>
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
              <p className="text-xs text-muted-foreground mt-1">{deleteItem.type} &middot; Used {deleteItem.usageCount.toLocaleString()} times</p>
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
