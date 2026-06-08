/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import { FileText, Upload, Send, Eye, Clock } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CardSkeleton } from "@/components/ui/loading-skeleton";

interface LabResult {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  order_id: string | null;
  title: string;
  file_key: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  status: "pending" | "reviewed" | "shared";
  whatsapp_notified: boolean;
  shared_at: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "text-yellow-600", badge: "warning" as const, label: "Pending" },
  reviewed: { icon: Eye, color: "text-blue-600", badge: "default" as const, label: "Reviewed" },
  shared: { icon: Send, color: "text-green-600", badge: "default" as const, label: "Shared" },
};

export default function LabResultsPage() {
  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/lab/results?${params}`);
      const json = await res.json();
      if (json.ok) {
        setResults(json.data.results);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const updateStatus = async (resultId: string, status: "reviewed" | "shared") => {
    setUpdating(resultId);
    try {
      const res = await fetch("/api/lab/results", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId, status }),
      });
      const json = await res.json();
      if (json.ok) {
        setResults((prev) => prev.map((r) => (r.id === resultId ? { ...r, status } : r)));
      }
    } finally {
      setUpdating(null);
    }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);

      const res = await fetch("/api/lab/results", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.ok) {
        form.reset();
        await fetchResults();
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb items={[{ label: "Admin" }, { label: "Lab Results" }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lab Results</h1>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border px-3 py-1.5 text-sm"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="shared">Shared</option>
          </select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Upload Lab Result
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <label htmlFor="lab-patientId" className="mb-1 block text-sm font-medium">
                Patient ID
              </label>
              <Input id="lab-patientId" name="patientId" placeholder="Patient UUID" required />
            </div>
            <div className="min-w-[200px] flex-1">
              <label htmlFor="lab-title" className="mb-1 block text-sm font-medium">
                Title
              </label>
              <Input id="lab-title" name="title" placeholder="e.g. Blood Test Results" required />
            </div>
            <div className="min-w-[200px] flex-1">
              <label htmlFor="lab-file" className="mb-1 block text-sm font-medium">
                File
              </label>
              <Input id="lab-file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
            </div>
            <div className="min-w-[200px] flex-1">
              <label htmlFor="lab-notes" className="mb-1 block text-sm font-medium">
                Notes
              </label>
              <Input id="lab-notes" name="notes" placeholder="Optional notes" />
            </div>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload & Notify"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground">No lab results found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {results.map((result) => {
            const config = STATUS_CONFIG[result.status];
            const StatusIcon = config.icon;

            return (
              <Card key={result.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`rounded-full bg-gray-100 p-2 ${config.color}`}>
                      <StatusIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{result.title}</p>
                      <p className="text-muted-foreground text-sm">
                        {new Date(result.created_at).toLocaleDateString()}
                        {result.file_name && ` · ${result.file_name}`}
                        {result.notes && ` · ${result.notes}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {result.whatsapp_notified && (
                      <Badge variant="outline" className="text-green-600">
                        WhatsApp sent
                      </Badge>
                    )}
                    <Badge variant={config.badge}>{config.label}</Badge>

                    {result.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(result.id, "reviewed")}
                        disabled={updating === result.id}
                      >
                        <Eye className="mr-1 h-3 w-3" /> Review
                      </Button>
                    )}

                    {(result.status === "pending" || result.status === "reviewed") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(result.id, "shared")}
                        disabled={updating === result.id}
                      >
                        <Send className="mr-1 h-3 w-3" /> Share
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
