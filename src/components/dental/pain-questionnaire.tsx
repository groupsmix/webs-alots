"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface PainQuestionnaireFormProps {
  onSubmit?: (data: PainData) => void;
}

interface PainData {
  painLevel: number;
  painLocation: string;
  painDuration: string;
  painType: string;
  triggers: string[];
  hasSwelling: boolean;
  hasBleeding: boolean;
  additionalNotes: string;
  sedationRequested: boolean;
}

const PAIN_TYPES = ["Sharp", "Throbbing", "Dull", "Burning", "Pressure", "Shooting"];
const COMMON_TRIGGERS = ["Hot food", "Cold food", "Chewing", "Sweet food", "Breathing", "Night time"];

export function PainQuestionnaireForm({ onSubmit }: PainQuestionnaireFormProps) {
  const [data, setData] = useState<PainData>({
    painLevel: 0,
    painLocation: "",
    painDuration: "",
    painType: "",
    triggers: [],
    hasSwelling: false,
    hasBleeding: false,
    additionalNotes: "",
    sedationRequested: false,
  });
  const [submitted, setSubmitted] = useState(false);

  const toggleTrigger = (trigger: string) => {
    setData((prev) => ({
      ...prev,
      triggers: prev.triggers.includes(trigger)
        ? prev.triggers.filter((t) => t !== trigger)
        : [...prev.triggers, trigger],
    }));
  };

  const handleSubmit = () => {
    onSubmit?.(data);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <AlertCircle className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-sm font-medium">Questionnaire submitted successfully!</p>
          <p className="text-xs text-muted-foreground mt-1">Your dentist will review this before your appointment.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Pre-Appointment Pain Questionnaire
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Pain Level */}
        <div>
          <Label className="text-sm font-medium">Pain Level (0-10)</Label>
          <div className="flex items-center gap-2 mt-2">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                onClick={() => setData({ ...data, painLevel: i })}
                className={`h-8 w-8 rounded-full text-xs font-medium transition-all ${
                  data.painLevel === i
                    ? i <= 3 ? "bg-green-500 text-white" : i <= 6 ? "bg-yellow-500 text-white" : "bg-red-500 text-white"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>No pain</span>
            <span>Moderate</span>
            <span>Worst pain</span>
          </div>
        </div>

        {/* Pain Location */}
        <div>
          <Label className="text-sm">Pain Location</Label>
          <Input
            value={data.painLocation}
            onChange={(e) => setData({ ...data, painLocation: e.target.value })}
            placeholder="e.g., Lower right molar area"
            className="mt-1"
          />
        </div>

        {/* Pain Duration */}
        <div>
          <Label className="text-sm">How long have you had this pain?</Label>
          <Input
            value={data.painDuration}
            onChange={(e) => setData({ ...data, painDuration: e.target.value })}
            placeholder="e.g., 2 weeks, 3 days"
            className="mt-1"
          />
        </div>

        {/* Pain Type */}
        <div>
          <Label className="text-sm">Type of Pain</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {PAIN_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setData({ ...data, painType: type })}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  data.painType === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Triggers */}
        <div>
          <Label className="text-sm">What triggers the pain?</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {COMMON_TRIGGERS.map((trigger) => (
              <button
                key={trigger}
                onClick={() => toggleTrigger(trigger)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  data.triggers.includes(trigger)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {trigger}
              </button>
            ))}
          </div>
        </div>

        {/* Swelling & Bleeding */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-sm">Swelling?</Label>
            <Switch
              checked={data.hasSwelling}
              onCheckedChange={(checked) => setData({ ...data, hasSwelling: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-sm">Bleeding?</Label>
            <Switch
              checked={data.hasBleeding}
              onCheckedChange={(checked) => setData({ ...data, hasBleeding: checked })}
            />
          </div>
        </div>

        {/* Sedation Flag */}
        <div className="flex items-center justify-between rounded-lg border p-3 bg-blue-50/50 dark:bg-blue-950/20">
          <div>
            <Label className="text-sm font-medium">Request Sedation</Label>
            <p className="text-xs text-muted-foreground">I would like sedation during the procedure</p>
          </div>
          <Switch
            checked={data.sedationRequested}
            onCheckedChange={(checked) => setData({ ...data, sedationRequested: checked })}
          />
        </div>

        {/* Additional Notes */}
        <div>
          <Label className="text-sm">Additional Notes</Label>
          <Textarea
            value={data.additionalNotes}
            onChange={(e) => setData({ ...data, additionalNotes: e.target.value })}
            placeholder="Any other information you'd like to share..."
            className="mt-1"
            rows={3}
          />
        </div>

        <Button onClick={handleSubmit} className="w-full">
          Submit Questionnaire
        </Button>
      </CardContent>
    </Card>
  );
}
