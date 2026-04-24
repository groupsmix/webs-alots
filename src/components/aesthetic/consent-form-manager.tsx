"use client";

import { useState } from "react";
import { FileCheck, Plus, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ConsentFormView {
  id: string;
  patientName: string;
  consentType: "before_after" | "marketing" | "medical_record";
  signedAt: string;
  isActive: boolean;
  expiresAt: string | null;
}

const CONSENT_LABELS: Record<string, string> = {
  before_after: "Before/After Photos",
  marketing: "Marketing Use",
  medical_record: "Medical Record",
};

const CONSENT_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  before_after: "default",
  marketing: "secondary",
  medical_record: "outline",
};

interface ConsentFormManagerProps {
  consents: ConsentFormView[];
  editable?: boolean;
  onAdd?: (consent: { patientName: string; consentType: string; consentText: string }) => void;
  onRevoke?: (id: string) => void;
}

export function ConsentFormManager({ consents, editable = false, onAdd, onRevoke }: ConsentFormManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ patientName: "", consentType: "before_after", consentText: "" });

  const handleAdd = () => {
    if (form.patientName.trim() && onAdd) {
      onAdd(form);
      setForm({ patientName: "", consentType: "before_after", consentText: "" });
      setShowForm(false);
    }
  };

  const activeCount = consents.filter((c) => c.isActive).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          Photo Consent Forms
          <Badge variant="secondary" className="ml-1">{activeCount} active</Badge>
        </h2>
        {editable && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            New Consent
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">New Consent Form</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Patient Name</Label>
                <Input value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} placeholder="Patient name" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Consent Type</Label>
                <select value={form.consentType} onChange={(e) => setForm({ ...form, consentType: e.target.value })} className="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="before_after">Before/After Photos</option>
                  <option value="marketing">Marketing Use</option>
                  <option value="medical_record">Medical Record</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Consent Text</Label>
              <Textarea value={form.consentText} onChange={(e) => setForm({ ...form, consentText: e.target.value })} placeholder="I consent to the use of my photos for..." className="text-sm" rows={3} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>Create Consent</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {consents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No consent forms on file.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {consents.map((consent) => {
            const isExpired = consent.expiresAt && new Date(consent.expiresAt) < new Date();
            return (
              <Card key={consent.id} className={!consent.isActive || isExpired ? "opacity-60" : ""}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className={`h-4 w-4 ${consent.isActive && !isExpired ? "text-green-600" : "text-muted-foreground"}`} />
                    <div>
                      <p className="text-sm font-medium">{consent.patientName}</p>
                      <p className="text-xs text-muted-foreground">
                        Signed: {new Date(consent.signedAt).toLocaleDateString()}
                        {consent.expiresAt && ` · Expires: ${new Date(consent.expiresAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={CONSENT_VARIANTS[consent.consentType]} className="text-xs">
                      {CONSENT_LABELS[consent.consentType]}
                    </Badge>
                    {isExpired && (
                      <Badge variant="destructive" className="text-[10px]">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Expired
                      </Badge>
                    )}
                    {!consent.isActive && <Badge variant="secondary" className="text-[10px]">Revoked</Badge>}
                    {editable && consent.isActive && !isExpired && (
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onRevoke?.(consent.id)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
