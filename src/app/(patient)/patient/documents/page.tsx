"use client";

import { useState } from "react";
import { Upload, FileText, Image, CreditCard, Download, Trash2, Eye, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb } from "@/components/ui/breadcrumb";

type DocType = "analysis" | "radiology" | "insurance" | "other";

interface PatientDocument {
  id: string;
  name: string;
  type: DocType;
  date: string;
  size: string;
  icon: typeof FileText;
}

const initialDocuments: PatientDocument[] = [
  { id: "doc1", name: "Blood Test Results", type: "analysis", date: "2026-03-15", size: "1.2 MB", icon: FileText },
  { id: "doc2", name: "Chest X-Ray", type: "radiology", date: "2026-02-20", size: "3.5 MB", icon: Image },
  { id: "doc3", name: "CNSS Insurance Card", type: "insurance", date: "2026-01-10", size: "0.8 MB", icon: CreditCard },
  { id: "doc4", name: "ECG Report", type: "analysis", date: "2025-12-05", size: "0.5 MB", icon: FileText },
  { id: "doc5", name: "Spine MRI", type: "radiology", date: "2025-11-18", size: "8.2 MB", icon: Image },
  { id: "doc6", name: "Allergy Panel Results", type: "analysis", date: "2025-10-02", size: "0.3 MB", icon: FileText },
];

const typeConfig: Record<DocType, { label: string; color: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  analysis: { label: "Analysis", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/50", variant: "default" },
  radiology: { label: "Radiology", color: "text-purple-600 bg-purple-100 dark:bg-purple-900/50", variant: "secondary" },
  insurance: { label: "Insurance", color: "text-green-600 bg-green-100 dark:bg-green-900/50", variant: "outline" },
  other: { label: "Other", color: "text-gray-600 bg-gray-100 dark:bg-gray-900/50", variant: "outline" },
};

export default function PatientDocumentsPage() {
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | DocType>("all");
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState<DocType>("analysis");
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = filter === "all" ? documents : documents.filter((d) => d.type === filter);

  const handleUpload = () => {
    setUploading(true);
    setTimeout(() => {
      const newDoc: PatientDocument = {
        id: `doc${Date.now()}`,
        name: fileName || "Uploaded Document",
        type: fileType,
        date: new Date().toISOString().split("T")[0],
        size: "1.0 MB",
        icon: fileType === "radiology" ? Image : fileType === "insurance" ? CreditCard : FileText,
      };
      setDocuments([newDoc, ...documents]);
      setUploading(false);
      setUploadSuccess(true);
      setTimeout(() => {
        setUploadOpen(false);
        setUploadSuccess(false);
        setFileName("");
        setFileType("analysis");
      }, 1500);
    }, 1200);
  };

  const handleDelete = (id: string) => {
    setDocuments(documents.filter((d) => d.id !== id));
    setDeleteId(null);
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "Patient", href: "/patient/dashboard" }, { label: "Documents" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">{documents.length} documents</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-1" />
          Upload Document
        </Button>
      </div>

      <Tabs defaultValue="all" className="mb-6">
        <TabsList>
          <TabsTrigger value="all" onClick={() => setFilter("all")}>
            <Filter className="h-3 w-3 mr-1" />
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
            const config = typeConfig[doc.type];
            return (
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${config.color}`}>
                    <doc.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
                      <span className="text-xs text-muted-foreground">{doc.date}</span>
                      <span className="text-xs text-muted-foreground">{doc.size}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" title="View">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Download">
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Delete" onClick={() => setDeleteId(doc.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>Upload radiology images, lab analyses, or insurance cards.</DialogDescription>
          </DialogHeader>
          {uploadSuccess ? (
            <div className="text-center py-6">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mx-auto mb-3">
                <Upload className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">Document uploaded successfully!</p>
            </div>
          ) : (
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
              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click to select a file</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, DICOM up to 25MB</p>
              </div>
              <Button className="w-full" onClick={handleUpload} disabled={uploading}>
                {uploading ? "Uploading..." : "Upload Document"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>Are you sure you want to delete this document? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteId && handleDelete(deleteId)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
