"use client";

import { Upload, FileText, Image, CreditCard, Download, Trash2, Filter } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DocType = "analysis" | "radiology" | "insurance" | "other";

interface DocumentView {
  id: string;
  name: string;
  type: string;
  fileType: string;
  size: number;
  key: string;
  date: string;
}

const typeConfig: Record<
  DocType,
  { label: string; color: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  analysis: {
    label: "Analysis",
    color: "text-blue-600 bg-blue-100 dark:bg-blue-900/50",
    variant: "default",
  },
  radiology: {
    label: "Radiology",
    color: "text-purple-600 bg-purple-100 dark:bg-purple-900/50",
    variant: "secondary",
  },
  insurance: {
    label: "Insurance",
    color: "text-green-600 bg-green-100 dark:bg-green-900/50",
    variant: "outline",
  },
  other: {
    label: "Other",
    color: "text-gray-600 bg-gray-100 dark:bg-gray-900/50",
    variant: "outline",
  },
};

function configForType(type: string) {
  return type in typeConfig ? typeConfig[type as DocType] : typeConfig.other;
}

function iconForType(type: string) {
  if (type === "radiology") return Image;
  if (type === "insurance") return CreditCard;
  return FileText;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// File types the patient_files upload pipeline accepts for documents.
const ACCEPTED_TYPES = "application/pdf,image/jpeg,image/png,image/webp";

export default function PatientDocumentsPage() {
  const [documents, setDocuments] = useState<DocumentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | DocType>("all");
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState<DocType>("analysis");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/patient/documents", { signal: controller.signal });
        const json = await res.json();
        if (controller.signal.aborted) return;
        if (res.ok && json.ok) {
          setDocuments(json.data.documents as DocumentView[]);
          setLoadError(null);
        } else {
          setLoadError(json.error ?? "Failed to load documents.");
        }
      } catch {
        if (!controller.signal.aborted) setLoadError("Failed to load documents.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [reloadKey]);

  const filtered = filter === "all" ? documents : documents.filter((d) => d.type === filter);

  const resetUploadForm = () => {
    setFileName("");
    setFileType("analysis");
    setSelectedFile(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadError(null);
    if (file && !fileName) {
      // Pre-fill the name from the file (drop the extension) for convenience.
      setFileName(file.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      // Step 1: upload the encrypted bytes to R2 via the shared pipeline
      // (magic-byte validation, AV scan, EXIF strip, PHI encryption).
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("category", "patient_files");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || !uploadJson.ok) {
        setUploadError(uploadJson.error ?? "Upload failed. Please try again.");
        return;
      }

      // Step 2: persist the document record linking the R2 object to the patient.
      const metaRes = await fetch("/api/patient/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          r2Key: uploadJson.data.key,
          fileName: fileName.trim() || selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
          docType: fileType,
          originalName: selectedFile.name,
        }),
      });
      const metaJson = await metaRes.json();
      if (!metaRes.ok || !metaJson.ok) {
        setUploadError(metaJson.error ?? "Failed to save the document. Please try again.");
        return;
      }

      resetUploadForm();
      setUploadOpen(false);
      setReloadKey((k) => k + 1);
    } catch {
      setUploadError("An error occurred during upload. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/patient/documents?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setReloadKey((k) => k + 1);
      }
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  if (loading) {
    return <PageLoader message="Loading documents..." />;
  }

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Patient", href: "/patient/dashboard" }, { label: "Documents" }]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">{documents.length} documents</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 me-1" />
          Upload Document
        </Button>
      </div>

      {loadError && (
        <Card className="mb-4 border-destructive/50">
          <CardContent className="py-4 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="link" className="mt-1" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all" className="mb-6">
        <TabsList>
          <TabsTrigger value="all" onClick={() => setFilter("all")}>
            <Filter className="h-3 w-3 me-1" />
            All ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="analysis" onClick={() => setFilter("analysis")}>
            Analysis
          </TabsTrigger>
          <TabsTrigger value="radiology" onClick={() => setFilter("radiology")}>
            Radiology
          </TabsTrigger>
          <TabsTrigger value="insurance" onClick={() => setFilter("insurance")}>
            Insurance
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No documents found</p>
            <Button variant="link" className="mt-2" onClick={() => setUploadOpen(true)}>
              Upload your first document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((doc) => {
            const config = configForType(doc.type);
            const DocIcon = iconForType(doc.type);
            return (
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4 p-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${config.color}`}
                  >
                    <DocIcon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={config.variant} className="text-xs">
                        {config.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{doc.date}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(doc.size)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <a
                      href={`/api/files/download?key=${encodeURIComponent(doc.key)}`}
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="sm" title="Download">
                        <Download className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Delete"
                      onClick={() => setDeleteId(doc.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) resetUploadForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload radiology images, lab analyses, or insurance cards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="docName">Document Name</Label>
              <Input
                id="docName"
                placeholder="e.g., Blood Test Results"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="docType">Document Type</Label>
              <select
                id="docType"
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                value={fileType}
                onChange={(e) => setFileType(e.target.value as DocType)}
              >
                <option value="analysis">Analysis / Lab Results</option>
                <option value="radiology">Radiology / X-Ray / MRI</option>
                <option value="insurance">Insurance Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              {selectedFile ? (
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              ) : (
                <p className="text-sm font-medium">Click to select a file</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, WebP up to 25MB</p>
            </button>
            {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
            <Button className="w-full" onClick={handleUpload} disabled={uploading || !selectedFile}>
              {uploading ? "Uploading..." : "Upload Document"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleting}
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              <Trash2 className="h-4 w-4 me-1" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
