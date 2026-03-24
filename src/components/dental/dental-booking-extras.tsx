"use client";

import { useState, useEffect } from "react";
import { Stethoscope, Clock, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { fetchDentalTreatmentTypes, type DentalTreatmentTypeView } from "@/lib/data/client";
import { clinicConfig } from "@/config/clinic.config";
import { useTenant } from "@/lib/hooks/use-tenant";
import { logger } from "@/lib/logger";

interface DentalBookingExtrasProps {
  selectedTreatment: string;
  onSelectTreatment: (id: string) => void;
  sedationRequested: boolean;
  onSedationChange: (value: boolean) => void;
}

export function DentalBookingExtras({
  selectedTreatment,
  onSelectTreatment,
  sedationRequested,
  onSedationChange,
}: DentalBookingExtrasProps) {
  const { clinicId } = useTenant();
  const [dentalTreatmentTypes, setDentalTreatmentTypes] = useState<DentalTreatmentTypeView[]>([]);

  useEffect(() => {
    if (!clinicId) return;
    fetchDentalTreatmentTypes(clinicId).then(setDentalTreatmentTypes).catch((err) => {
      logger.warn("Operation failed", { context: "dental-booking-extras", error: err });
    });
  }, []);

  const categories = Array.from(new Set(dentalTreatmentTypes.map((t) => t.category)));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-3">Select Treatment Type</p>
        {categories.map((category) => (
          <div key={category} className="mb-3">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">{category}</p>
            <div className="grid gap-2">
              {dentalTreatmentTypes
                .filter((t) => t.category === category)
                .map((treatment) => (
                  <button
                    key={treatment.id}
                    onClick={() => onSelectTreatment(treatment.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      selectedTreatment === treatment.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-medium">{treatment.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {treatment.durationMinutes} min
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {treatment.price} {treatment.currency}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">{treatment.description}</p>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sedation Flag */}
      <div className="flex items-center justify-between rounded-lg border p-4 bg-blue-50/50 dark:bg-blue-950/20">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-blue-600" />
          <div>
            <Label className="text-sm font-medium">Request Sedation</Label>
            <p className="text-xs text-muted-foreground">I would like sedation during the procedure</p>
          </div>
        </div>
        <Switch checked={sedationRequested} onCheckedChange={onSedationChange} />
      </div>
    </div>
  );
}
