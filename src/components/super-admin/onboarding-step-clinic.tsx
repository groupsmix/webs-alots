"use client";

import {
  Building2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export interface ClinicFormData {
  name: string;
  type: "doctor" | "dentist" | "pharmacy";
  tier: "vitrine" | "cabinet" | "pro" | "premium" | "saas";
  city: string;
  phone: string;
  email: string;
  address: string;
  specialty: string;
  subdomain: string;
  domain: string;
}

interface StepClinicProps {
  clinicForm: ClinicFormData;
  loading: boolean;
  onUpdateField: (field: keyof ClinicFormData, value: string) => void;
  onSubmit: () => void;
}

export function OnboardingStepClinic({
  clinicForm,
  loading,
  onUpdateField,
  onSubmit,
}: StepClinicProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Step 1: Create Clinic
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>
              Clinic Name <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="e.g. Cabinet Dr. Sara Tazi"
              value={clinicForm.name}
              onChange={(e) => onUpdateField("name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Clinic Type</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={clinicForm.type}
              onChange={(e) => onUpdateField("type", e.target.value)}
            >
              <option value="doctor">Doctor</option>
              <option value="dentist">Dentist</option>
              <option value="pharmacy">Pharmacy</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Subscription Tier</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={clinicForm.tier}
              onChange={(e) => onUpdateField("tier", e.target.value)}
            >
              <option value="vitrine">Vitrine — 2,500-3,000 MAD</option>
              <option value="cabinet">Cabinet — 6,000-8,000 MAD</option>
              <option value="pro">Pro — 12,000-15,000 MAD</option>
              <option value="premium">Premium — 20,000-25,000 MAD</option>
              <option value="saas">SaaS Monthly — 500-1,000 MAD/mo</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Specialty</Label>
            <Input
              placeholder="e.g. Dermatology, General Medicine"
              value={clinicForm.specialty}
              onChange={(e) =>
                onUpdateField("specialty", e.target.value)
              }
            />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              placeholder="+212 5 37 XX XX XX"
              value={clinicForm.phone}
              onChange={(e) => onUpdateField("phone", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="contact@clinic.ma"
              value={clinicForm.email}
              onChange={(e) => onUpdateField("email", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>City</Label>
            <Input
              placeholder="e.g. Rabat"
              value={clinicForm.city}
              onChange={(e) => onUpdateField("city", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>
              Subdomain <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-1">
              <Input
                placeholder="e.g. dr-sara"
                value={clinicForm.subdomain}
                onChange={(e) => {
                  const value = e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/--+/g, "-")
                    .replace(/^-/, "");
                  onUpdateField("subdomain", value);
                }}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">.oltigo.com</span>
            </div>
            <p className="text-xs text-muted-foreground">
              The clinic will be accessible at <strong>{clinicForm.subdomain || "___"}.oltigo.com</strong>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Custom Domain (optional)</Label>
            <Input
              placeholder="e.g. dr-sara.ma"
              value={clinicForm.domain}
              onChange={(e) => onUpdateField("domain", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Address</Label>
          <Input
            placeholder="45 Avenue Hassan II, Rabat"
            value={clinicForm.address}
            onChange={(e) => onUpdateField("address", e.target.value)}
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Create Clinic & Continue
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
