"use client";

import { useState } from "react";
import { FileText, Copy, Edit, Trash2, Plus, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Template {
  id: string;
  name: string;
  type: "prescription" | "invoice" | "report" | "letter" | "consent";
  description: string;
  clinicType: "doctor" | "dentist" | "pharmacy" | "all";
  lastModified: string;
  usageCount: number;
  active: boolean;
}

const templates: Template[] = [
  { id: "t1", name: "Standard Prescription", type: "prescription", description: "Default prescription template with medication list, dosage, and notes fields.", clinicType: "all", lastModified: "2026-03-15", usageCount: 1234, active: true },
  { id: "t2", name: "Dental Treatment Plan", type: "report", description: "Comprehensive dental treatment plan with procedure details and cost estimates.", clinicType: "dentist", lastModified: "2026-03-12", usageCount: 456, active: true },
  { id: "t3", name: "Pharmacy Invoice", type: "invoice", description: "Standard pharmacy invoice with medication list and insurance details.", clinicType: "pharmacy", lastModified: "2026-03-10", usageCount: 892, active: true },
  { id: "t4", name: "Medical Certificate", type: "letter", description: "Official medical certificate for work/school absences.", clinicType: "doctor", lastModified: "2026-03-08", usageCount: 567, active: true },
  { id: "t5", name: "Surgery Consent Form", type: "consent", description: "Patient consent form for surgical procedures.", clinicType: "doctor", lastModified: "2026-03-05", usageCount: 89, active: true },
  { id: "t6", name: "Lab Results Report", type: "report", description: "Template for formatting and presenting lab results to patients.", clinicType: "all", lastModified: "2026-02-28", usageCount: 345, active: false },
  { id: "t7", name: "Dental X-Ray Report", type: "report", description: "Template for panoramic and periapical X-ray findings.", clinicType: "dentist", lastModified: "2026-02-20", usageCount: 178, active: true },
  { id: "t8", name: "Referral Letter", type: "letter", description: "Standard referral letter to specialists with patient history summary.", clinicType: "all", lastModified: "2026-02-15", usageCount: 234, active: true },
];

const typeColors: Record<string, string> = {
  prescription: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  invoice: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  report: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  letter: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  consent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const clinicTypeLabels: Record<string, string> = {
  doctor: "Doctor",
  dentist: "Dentist",
  pharmacy: "Pharmacy",
  all: "All Clinics",
};

export default function SuperAdminTemplatesPage() {
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all"
    ? templates
    : templates.filter((t) => t.type === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Template Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage document templates for all clinics</p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Template
        </Button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "prescription", "invoice", "report", "letter", "consent"].map((type) => (
          <Button
            key={type}
            variant={filter === type ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(type)}
            className="capitalize"
          >
            {type === "all" ? "All Types" : type}
          </Button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{templates.length}</p>
            <p className="text-xs text-muted-foreground">Total Templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{templates.filter((t) => t.active).length}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{templates.reduce((sum, t) => sum + t.usageCount, 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Uses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{new Set(templates.map((t) => t.clinicType)).size}</p>
            <p className="text-xs text-muted-foreground">Clinic Types</p>
          </CardContent>
        </Card>
      </div>

      {/* Template Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((template) => (
          <Card key={template.id} className={!template.active ? "opacity-60" : ""}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <p className="font-medium text-sm">{template.name}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${typeColors[template.type]}`}>
                    {template.type}
                  </span>
                  {!template.active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{template.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{clinicTypeLabels[template.clinicType]}</Badge>
                  <span className="text-[10px] text-muted-foreground">{template.usageCount} uses</span>
                  <span className="text-[10px] text-muted-foreground">Modified: {template.lastModified}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Preview">
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Duplicate">
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="Delete">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
