"use client";

import { useState, useEffect } from "react";
import {
  Plus, ClipboardList, Save, FlaskConical,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/data/client";
import {
  fetchUrologyExams, createUrologyExam,
  type UrologyExamView,
} from "@/lib/data/specialists";
import { PageLoader } from "@/components/ui/page-loader";

const UROLOGY_TEMPLATES = [
  { value: "general", label: "General Urology Exam" },
  { value: "prostate", label: "Prostate Examination" },
  { value: "kidney", label: "Kidney Assessment" },
  { value: "bladder", label: "Bladder Function" },
  { value: "uti", label: "UTI Evaluation" },
  { value: "stone", label: "Kidney Stone Assessment" },
];

const TEMPLATE_FIELDS: Record<string, string[]> = {
  general: ["Chief Complaint", "History", "Physical Examination", "Urinalysis", "Assessment"],
  prostate: ["PSA Level", "DRE Findings", "Prostate Size", "IPSS Score", "Flow Rate"],
  kidney: ["Creatinine", "GFR", "Ultrasound Findings", "Urine Output", "Symptoms"],
  bladder: ["Residual Volume", "Frequency", "Urgency", "Incontinence", "Cystoscopy"],
  uti: ["Symptoms", "Urinalysis", "Culture Results", "Previous Episodes", "Risk Factors"],
  stone: ["Stone Size", "Stone Location", "Composition", "Pain Level", "Imaging Findings"],
};

export default function UrologyPage() {
  const [exams, setExams] = useState<UrologyExamView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    templateType: "general",
    findings: {} as Record<string, string>,
    labResults: {} as Record<string, string>,
    diagnosis: "", plan: "",
  });

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const e = await fetchUrologyExams(user.clinic_id);
    setExams(e);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return <PageLoader message="Loading urology records..." />;
  }

  const handleAdd = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const newId = await createUrologyExam({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      template_type: form.templateType, findings: form.findings,
      lab_results: form.labResults, diagnosis: form.diagnosis, plan: form.plan,
    });
    if (newId) {
      setExams((prev) => [{
        id: newId, patientId: user.id, patientName: "",
        examDate: new Date().toISOString().split("T")[0],
        templateType: form.templateType, findings: form.findings,
        labResults: form.labResults, diagnosis: form.diagnosis, plan: form.plan,
      }, ...prev]);
    }
    setForm({ templateType: "general", findings: {}, labResults: {}, diagnosis: "", plan: "" });
    setShowForm(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Urology</h1>

      <Tabs defaultValue="exams">
        <TabsList className="mb-4">
          <TabsTrigger value="exams">Exam Records</TabsTrigger>
          <TabsTrigger value="labs">Lab Results</TabsTrigger>
        </TabsList>

        <TabsContent value="exams">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Exam
            </Button>
          </div>

          {exams.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No urology exams recorded.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => (
                <Card key={exam.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">
                          {UROLOGY_TEMPLATES.find((t) => t.value === exam.templateType)?.label ?? exam.templateType}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{exam.examDate}</span>
                    </div>
                    {Object.entries(exam.findings).length > 0 && (
                      <div className="rounded-lg bg-muted/50 p-3 mb-2">
                        {Object.entries(exam.findings).map(([key, value]) => (
                          <div key={key} className="text-sm flex gap-2">
                            <span className="font-medium">{key}:</span>
                            <span className="text-muted-foreground">{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {exam.diagnosis && <p className="text-sm"><span className="font-medium">Diagnosis:</span> {exam.diagnosis}</p>}
                    {exam.plan && <p className="text-sm text-muted-foreground mt-1"><span className="font-medium">Plan:</span> {exam.plan}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="labs">
          <Card><CardContent className="py-8">
            <div className="space-y-3">
              {exams.filter((e) => Object.keys(e.labResults).length > 0).length === 0 ? (
                <div className="text-center">
                  <FlaskConical className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No lab results tracked.</p>
                </div>
              ) : (
                exams.filter((e) => Object.keys(e.labResults).length > 0).map((exam) => (
                  <div key={exam.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        {UROLOGY_TEMPLATES.find((t) => t.value === exam.templateType)?.label ?? exam.templateType}
                      </span>
                      <span className="text-xs text-muted-foreground">{exam.examDate}</span>
                    </div>
                    {Object.entries(exam.labResults).map(([key, value]) => (
                      <div key={key} className="text-sm flex gap-2">
                        <span className="font-medium">{key}:</span>
                        <span className="text-muted-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Urology Exam</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={form.templateType} onValueChange={(v) => setForm((p) => ({
                ...p, templateType: v, findings: {},
              }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UROLOGY_TEMPLATES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Findings</Label>
              {(TEMPLATE_FIELDS[form.templateType] ?? []).map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{field}</Label>
                  <Input placeholder={`${field}...`}
                    value={form.findings[field] ?? ""}
                    onChange={(e) => setForm((p) => ({
                      ...p, findings: { ...p.findings, [field]: e.target.value },
                    }))} />
                </div>
              ))}
            </div>
            <div className="border-t pt-3">
              <Label className="text-xs">Lab Results (optional)</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {["Urinalysis", "PSA", "Creatinine", "Culture"].map((lab) => (
                  <div key={lab} className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{lab}</Label>
                    <Input className="h-7 text-xs" placeholder={lab}
                      value={form.labResults[lab] ?? ""}
                      onChange={(e) => setForm((p) => ({
                        ...p, labResults: { ...p.labResults, [lab]: e.target.value },
                      }))} />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Diagnosis</Label>
              <Textarea placeholder="Diagnosis..." value={form.diagnosis}
                onChange={(e) => setForm((p) => ({ ...p, diagnosis: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Textarea placeholder="Treatment plan..." value={form.plan}
                onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleAdd}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
