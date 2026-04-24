"use client";

import { Building2, Plus, Users, Edit2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DepartmentView {
  id: string;
  name: string;
  nameAr: string | null;
  headDoctorName: string | null;
  floor: string | null;
  description: string | null;
  doctorCount: number;
  patientCount: number;
  isActive: boolean;
}

interface DepartmentManagementProps {
  departments: DepartmentView[];
  editable?: boolean;
  onAdd?: (dept: { name: string; nameAr: string; floor: string; description: string }) => void;
  onToggleActive?: (id: string, active: boolean) => void;
}

export function DepartmentManagement({ departments, editable = false, onAdd, onToggleActive }: DepartmentManagementProps) {
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", nameAr: "", floor: "", description: "" });

  const handleAdd = () => {
    if (form.name.trim() && onAdd) {
      onAdd(form);
      setForm({ name: "", nameAr: "", floor: "", description: "" });
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Departments
          <Badge variant="secondary" className="ml-1">{departments.length}</Badge>
        </h2>
        {editable && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Department
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">New Department</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Name (FR)</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cardiologie" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Name (AR)</Label>
                <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} placeholder="أمراض القلب" className="text-sm" dir="rtl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Floor</Label>
                <Input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="2nd Floor" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Department description..." className="text-sm" rows={1} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>Create</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {departments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No departments configured yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {departments.map((dept) => (
            <Card key={dept.id} className={!dept.isActive ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium">{dept.name}</p>
                      {dept.nameAr && <span className="text-xs text-muted-foreground" dir="rtl">{dept.nameAr}</span>}
                      {!dept.isActive && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                    </div>
                    {dept.floor && <p className="text-xs text-muted-foreground">Floor: {dept.floor}</p>}
                    {dept.headDoctorName && <p className="text-xs text-muted-foreground">Head: {dept.headDoctorName}</p>}
                  </div>
                  <button onClick={() => setExpanded(expanded === dept.id ? null : dept.id)} className="p-1 hover:bg-muted rounded">
                    {expanded === dept.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {dept.doctorCount} doctors</span>
                  <span>{dept.patientCount} patients</span>
                </div>
                {expanded === dept.id && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {dept.description && <p className="text-xs text-muted-foreground">{dept.description}</p>}
                    {editable && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs h-7">
                          <Edit2 className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onToggleActive?.(dept.id, !dept.isActive)}>
                          {dept.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
