"use client";

import {
  Stethoscope,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ServiceFormData {
  name: string;
  price: string;
  duration_minutes: string;
  category: string;
}

interface StepServicesProps {
  services: ServiceFormData[];
  loading: boolean;
  onAddService: () => void;
  onRemoveService: (index: number) => void;
  onUpdateService: (index: number, field: keyof ServiceFormData, value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function OnboardingStepServices({
  services,
  loading,
  onAddService,
  onRemoveService,
  onUpdateService,
  onBack,
  onSubmit,
}: StepServicesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5" />
          Step 3: Add Services
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Add the services this clinic offers (consultations, treatments, etc.)
        </p>

        {services.map((service, index) => (
          <div
            key={index}
            className="rounded-lg border p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Badge variant="outline">Service #{index + 1}</Badge>
              {services.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => onRemoveService(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Service Name{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="e.g. Consultation Générale"
                  value={service.name}
                  onChange={(e) =>
                    onUpdateService(index, "name", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={service.category}
                  onChange={(e) =>
                    onUpdateService(index, "category", e.target.value)
                  }
                >
                  <option value="consultation">Consultation</option>
                  <option value="treatment">Treatment</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="diagnostic">Diagnostic</option>
                  <option value="screening">Screening</option>
                  <option value="vaccination">Vaccination</option>
                  <option value="dental">Dental</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Price (MAD)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 400"
                  value={service.price}
                  onChange={(e) =>
                    onUpdateService(index, "price", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  placeholder="30"
                  value={service.duration_minutes}
                  onChange={(e) =>
                    onUpdateService(
                      index,
                      "duration_minutes",
                      e.target.value,
                    )
                  }
                />
              </div>
            </div>
          </div>
        ))}

        <Button variant="outline" onClick={onAddService}>
          <Plus className="h-4 w-4 mr-1" />
          Add Another Service
        </Button>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save Services & Continue
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
