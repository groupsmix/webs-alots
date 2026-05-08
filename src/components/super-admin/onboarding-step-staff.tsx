"use client";

import {
  Users,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface UserFormData {
  role: "clinic_admin" | "receptionist" | "doctor";
  name: string;
  phone: string;
  email: string;
}

interface StepStaffProps {
  users: UserFormData[];
  loading: boolean;
  onAddUser: () => void;
  onRemoveUser: (index: number) => void;
  onUpdateUser: (index: number, field: keyof UserFormData, value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function OnboardingStepStaff({
  users,
  loading,
  onAddUser,
  onRemoveUser,
  onUpdateUser,
  onBack,
  onSubmit,
}: StepStaffProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Step 2: Add Staff Members
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Add the clinic owner (admin), doctors, and receptionists.
          At least one clinic_admin is required.
        </p>

        {users.map((user, index) => (
          <div
            key={index}
            className="rounded-lg border p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="capitalize">
                Staff #{index + 1}
              </Badge>
              {users.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => onRemoveUser(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Role</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={user.role}
                  onChange={(e) =>
                    onUpdateUser(index, "role", e.target.value)
                  }
                >
                  <option value="clinic_admin">
                    Clinic Admin (Owner)
                  </option>
                  <option value="doctor">Doctor</option>
                  <option value="receptionist">Receptionist</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Dr. Sara Tazi"
                  value={user.name}
                  onChange={(e) =>
                    onUpdateUser(index, "name", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="+212 6 XX XX XX XX"
                  value={user.phone}
                  onChange={(e) =>
                    onUpdateUser(index, "phone", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Email{user.role === "clinic_admin" ? <span className="text-destructive"> *</span> : null}
                </Label>
                <Input
                  type="email"
                  placeholder="sara@clinic.ma"
                  value={user.email}
                  onChange={(e) =>
                    onUpdateUser(index, "email", e.target.value)
                  }
                  required={user.role === "clinic_admin"}
                />
                <p className="text-[11px] text-muted-foreground">
                  {user.role === "clinic_admin"
                    ? "Required — a login account will be created with a default password."
                    : "A login account will be created automatically if a valid email is provided."}
                </p>
              </div>
            </div>
          </div>
        ))}

        <Button variant="outline" onClick={onAddUser}>
          <Plus className="h-4 w-4 mr-1" />
          Add Another Staff Member
        </Button>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save Staff & Continue
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
