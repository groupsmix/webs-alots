"use client";

import {
  Eye, Clock, CheckCircle, Package, Truck,
  ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OpticalPrescription } from "@/lib/types/para-medical";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "outline" | "destructive"> = {
  pending: "outline",
  in_progress: "default",
  ready: "success",
  delivered: "secondary",
};

const STATUS_ICON: Record<string, typeof Clock> = {
  pending: Clock,
  in_progress: Package,
  ready: CheckCircle,
  delivered: Truck,
};

interface OpticalPrescriptionTrackerProps {
  prescriptions: OpticalPrescription[];
  editable?: boolean;
  onUpdateStatus?: (id: string, status: OpticalPrescription["status"]) => void;
}

function formatDiopter(value: number | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

export function OpticalPrescriptionTracker({
  prescriptions,
  editable = false,
  onUpdateStatus,
}: OpticalPrescriptionTrackerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...prescriptions].sort(
    (a, b) => new Date(b.prescription_date).getTime() - new Date(a.prescription_date).getTime()
  );

  const pending = prescriptions.filter((p) => p.status === "pending").length;
  const inProgress = prescriptions.filter((p) => p.status === "in_progress").length;
  const ready = prescriptions.filter((p) => p.status === "ready").length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{prescriptions.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{ready}</p>
            <p className="text-xs text-muted-foreground">Ready</p>
          </CardContent>
        </Card>
      </div>

      {/* Prescriptions */}
      {sorted.length === 0 && (
        <div className="text-center py-12">
          <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No prescriptions yet.</p>
        </div>
      )}
      {sorted.map((rx) => {
        const isExpanded = expandedId === rx.id;
        const StatusIcon = STATUS_ICON[rx.status];
        const isExpired = rx.expiry_date && new Date(rx.expiry_date) < new Date();

        return (
          <Card key={rx.id}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : rx.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye className="h-5 w-5 text-blue-600" />
                  <div>
                    <CardTitle className="text-sm">{rx.patient_name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rx.prescription_date}
                      {rx.ophthalmologist_name && ` — Dr. ${rx.ophthalmologist_name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isExpired && (
                    <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Expired
                    </Badge>
                  )}
                  <Badge variant={STATUS_VARIANT[rx.status]} className="text-xs flex items-center gap-1">
                    <StatusIcon className="h-3 w-3" /> {rx.status.replace("_", " ")}
                  </Badge>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-3">
                {/* Prescription table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2"></th>
                        <th className="text-center py-2 px-2">Sphere (SPH)</th>
                        <th className="text-center py-2 px-2">Cylinder (CYL)</th>
                        <th className="text-center py-2 px-2">Axis</th>
                        <th className="text-center py-2 px-2">Add</th>
                        <th className="text-center py-2 px-2">PD</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2 px-2 font-medium">OD (Right)</td>
                        <td className="text-center py-2 px-2">{formatDiopter(rx.right_eye.sphere)}</td>
                        <td className="text-center py-2 px-2">{formatDiopter(rx.right_eye.cylinder)}</td>
                        <td className="text-center py-2 px-2">{rx.right_eye.axis ?? "—"}{rx.right_eye.axis !== null ? "°" : ""}</td>
                        <td className="text-center py-2 px-2">{formatDiopter(rx.right_eye.add)}</td>
                        <td className="text-center py-2 px-2">{rx.right_eye.pd ?? "—"}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 font-medium">OS (Left)</td>
                        <td className="text-center py-2 px-2">{formatDiopter(rx.left_eye.sphere)}</td>
                        <td className="text-center py-2 px-2">{formatDiopter(rx.left_eye.cylinder)}</td>
                        <td className="text-center py-2 px-2">{rx.left_eye.axis ?? "—"}{rx.left_eye.axis !== null ? "°" : ""}</td>
                        <td className="text-center py-2 px-2">{formatDiopter(rx.left_eye.add)}</td>
                        <td className="text-center py-2 px-2">{rx.left_eye.pd ?? "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-3">
                  {rx.lens_type && (
                    <div className="p-2 rounded border">
                      <p className="text-[10px] text-muted-foreground">Lens Type</p>
                      <p className="text-xs font-medium">{rx.lens_type}</p>
                    </div>
                  )}
                  {rx.expiry_date && (
                    <div className="p-2 rounded border">
                      <p className="text-[10px] text-muted-foreground">Expiry Date</p>
                      <p className={`text-xs font-medium ${isExpired ? "text-red-600" : ""}`}>{rx.expiry_date}</p>
                    </div>
                  )}
                </div>

                {rx.notes && (
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <p className="text-xs"><strong>Notes:</strong> {rx.notes}</p>
                  </div>
                )}

                {/* Status actions */}
                {editable && rx.status !== "delivered" && (
                  <div className="flex gap-2 pt-2 border-t">
                    {rx.status === "pending" && (
                      <button className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700" onClick={() => onUpdateStatus?.(rx.id, "in_progress")}>
                        Start Processing
                      </button>
                    )}
                    {rx.status === "in_progress" && (
                      <button className="px-3 py-1.5 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700" onClick={() => onUpdateStatus?.(rx.id, "ready")}>
                        Mark Ready
                      </button>
                    )}
                    {rx.status === "ready" && (
                      <button className="px-3 py-1.5 rounded-md text-xs font-medium bg-purple-600 text-white hover:bg-purple-700" onClick={() => onUpdateStatus?.(rx.id, "delivered")}>
                        Mark Delivered
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
