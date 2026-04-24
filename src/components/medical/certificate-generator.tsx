"use client";

import { Plus, Download, FileText, Printer } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MedicalCertificateView } from "@/lib/data/client";

type CertificateType = MedicalCertificateView["type"];

const CERTIFICATE_TYPES: { value: CertificateType; label: string }[] = [
  { value: "sick_leave", label: "Sick Leave" },
  { value: "fitness", label: "Fitness Certificate" },
  { value: "medical_report", label: "Medical Report" },
  { value: "disability", label: "Disability Certificate" },
  { value: "custom", label: "Custom Certificate" },
];

interface CertificateGeneratorProps {
  certificates: MedicalCertificateView[];
  patients: { id: string; name: string }[];
  clinic?: { name: string; address?: string; phone?: string };
  onCreateCertificate?: (data: {
    patientId: string;
    type: CertificateType;
    content: Record<string, unknown>;
  }) => void;
}

function generateCertificateSVG(cert: MedicalCertificateView): void {
  const content = cert.content as Record<string, string>;
  const lineHeight = 20;
  let y = 60;

  const lines: string[] = [];
  const addLine = (text: string, fontSize: number = 12, bold: boolean = false) => {
    const weight = bold ? "bold" : "normal";
    lines.push(
      `<text x="40" y="${y}" font-size="${fontSize}" font-weight="${weight}" font-family="Helvetica, Arial, sans-serif">${escapeXml(text)}</text>`,
    );
    y += lineHeight + (fontSize > 12 ? 8 : 2);
  };

  const escapeXml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const typeLabel = CERTIFICATE_TYPES.find((t) => t.value === cert.type)?.label ?? cert.type;
  addLine("MEDICAL CERTIFICATE", 20, true);
  y += 5;
  addLine(`Type: ${typeLabel}`, 14, true);
  addLine(`Doctor: ${cert.doctorName}`);
  addLine(`Patient: ${cert.patientName}`);
  addLine(`Date: ${cert.issuedDate}`);
  y += 10;

  lines.push(`<line x1="40" y1="${y}" x2="560" y2="${y}" stroke="#ccc" stroke-width="1" />`);
  y += 15;

  if (content.reason) {
    addLine("Reason:", 12, true);
    addLine(content.reason);
    y += 5;
  }

  if (content.startDate && content.endDate) {
    addLine(`Period: ${content.startDate} to ${content.endDate}`);
    y += 5;
  }

  if (content.details) {
    addLine("Details:", 12, true);
    const detailLines = content.details.split("\n");
    for (const line of detailLines) {
      addLine(line);
    }
    y += 5;
  }

  if (content.recommendations) {
    addLine("Recommendations:", 12, true);
    addLine(content.recommendations);
  }

  y += 40;
  lines.push(`<line x1="350" y1="${y}" x2="540" y2="${y}" stroke="#333" stroke-width="1" />`);
  y += 15;
  addLine("Doctor's Signature");

  const pageHeight = Math.max(y + 60, 600);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${pageHeight}" viewBox="0 0 600 ${pageHeight}">
  <rect width="600" height="${pageHeight}" fill="white"/>
  <rect x="20" y="20" width="560" height="${pageHeight - 40}" fill="none" stroke="#e0e0e0" stroke-width="1" rx="4"/>
  ${lines.join("\n  ")}
</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `certificate-${cert.patientName.replace(/\s+/g, "-").toLowerCase()}-${cert.issuedDate}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function printCertificate(cert: MedicalCertificateView, clinic?: { name: string; address?: string; phone?: string }): void {
  const content = cert.content as Record<string, string>;
  const typeLabel = CERTIFICATE_TYPES.find((t) => t.value === cert.type)?.label ?? cert.type;
  const clinicName = clinic?.name || "";
  const clinicAddress = clinic?.address || "";
  const clinicPhone = clinic?.phone || "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Certificate – ${cert.patientName}</title>
<style>
  body{font-family:Helvetica,Arial,sans-serif;font-size:11pt;line-height:1.6;color:#000;margin:0;padding:20mm}
  .letterhead{text-align:center;margin-bottom:12pt}
  .letterhead h2{font-size:14pt;margin:0 0 2pt;color:#333}
  .letterhead p{font-size:9pt;color:#555;margin:0}
  .header{text-align:center;border-bottom:2px solid #333;padding-bottom:12pt;margin-bottom:18pt}
  .header h1{font-size:16pt;margin:0 0 4pt}
  .header p{font-size:9pt;color:#555;margin:0}
  .field{margin-bottom:8pt}
  .field-label{font-weight:600}
  .signature{margin-top:48pt;text-align:right;border-top:1px solid #999;padding-top:8pt;width:40%;margin-left:auto}
  @page{size:A4;margin:20mm}
</style></head><body>
${clinicName ? `<div class="letterhead"><h2>${clinicName}</h2>${clinicAddress ? `<p>${clinicAddress}</p>` : ""}${clinicPhone ? `<p>Tél : ${clinicPhone}</p>` : ""}</div>` : ""}
<div class="header"><h1>CERTIFICAT MÉDICAL</h1><p>${typeLabel}</p></div>
<div class="field"><span class="field-label">Patient :</span> ${cert.patientName}</div>
<div class="field"><span class="field-label">Médecin :</span> ${cert.doctorName}</div>
<div class="field"><span class="field-label">Date :</span> ${cert.issuedDate}</div>
${content.reason ? `<div class="field"><span class="field-label">Motif :</span> ${content.reason}</div>` : ""}
${content.startDate && content.endDate ? `<div class="field"><span class="field-label">Période :</span> du ${content.startDate} au ${content.endDate}</div>` : ""}
${content.details ? `<div class="field"><span class="field-label">Détails :</span><br/>${content.details.replace(/\n/g, "<br/>")}</div>` : ""}
${content.recommendations ? `<div class="field"><span class="field-label">Recommandations :</span> ${content.recommendations}</div>` : ""}
<div class="signature">Signature du médecin</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.addEventListener("load", () => { win.print(); });
}

export function CertificateGenerator({
  certificates,
  patients,
  clinic,
  onCreateCertificate,
}: CertificateGeneratorProps) {
  const [showForm, setShowForm] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(patients[0]?.id ?? "");
  const [certType, setCertType] = useState<CertificateType>("sick_leave");
  const [formData, setFormData] = useState({
    reason: "",
    startDate: "",
    endDate: "",
    details: "",
    recommendations: "",
  });

  const handleCreate = () => {
    if (!selectedPatient || !onCreateCertificate) return;
    onCreateCertificate({
      patientId: selectedPatient,
      type: certType,
      content: { ...formData },
    });
    setFormData({ reason: "", startDate: "", endDate: "", details: "", recommendations: "" });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        {onCreateCertificate && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Certificate
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {certificates.map((cert) => {
          const typeLabel = CERTIFICATE_TYPES.find((t) => t.value === cert.type)?.label ?? cert.type;
          return (
            <Card key={cert.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 mt-0.5 text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{cert.patientName}</p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {typeLabel}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <p>Doctor: {cert.doctorName} &middot; Issued: {cert.issuedDate}</p>
                      {(cert.content as Record<string, string>).reason && (
                        <p>Reason: {(cert.content as Record<string, string>).reason}</p>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateCertificateSVG(cert)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printCertificate(cert, clinic)}
                      >
                        <Printer className="h-3.5 w-3.5 mr-1" />
                        Print
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {certificates.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No certificates yet. Create one to get started.
          </p>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg" onClose={() => setShowForm(false)}>
          <DialogHeader>
            <DialogTitle>New Medical Certificate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Patient</Label>
                <select
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Certificate Type</Label>
                <select
                  value={certType}
                  onChange={(e) => setCertType(e.target.value as CertificateType)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {CERTIFICATE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                placeholder="Reason for certificate..."
                value={formData.reason}
                onChange={(e) => setFormData((p) => ({ ...p, reason: e.target.value }))}
              />
            </div>
            {(certType === "sick_leave" || certType === "disability") && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Details</Label>
              <Textarea
                placeholder="Additional details..."
                value={formData.details}
                onChange={(e) => setFormData((p) => ({ ...p, details: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Recommendations</Label>
              <Input
                placeholder="Recommendations..."
                value={formData.recommendations}
                onChange={(e) => setFormData((p) => ({ ...p, recommendations: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Certificate</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
