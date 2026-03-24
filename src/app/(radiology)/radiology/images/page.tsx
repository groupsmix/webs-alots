"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import NextImage from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Image as ImageIcon, ExternalLink, Eye, FileImage, Upload, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useTenant } from "@/components/tenant-provider";
import { fetchRadiologyOrders } from "@/lib/data/client";
import type { RadiologyOrderView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

export default function RadiologyImagesPage() {
  const tenant = useTenant();
  const [orders, setOrders] = useState<RadiologyOrderView[]>([]);
  const [allOrders, setAllOrders] = useState<RadiologyOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadOrderId, setUploadOrderId] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshOrders = useCallback(() => {
    fetchRadiologyOrders(tenant?.clinicId ?? "").then((all) => {
      setAllOrders(all);
      setOrders(all.filter((o) => o.imageCount > 0));
    });
  }, [tenant?.clinicId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchRadiologyOrders(tenant?.clinicId ?? "")
      .then((all) => {
      if (controller.signal.aborted) return;
        setAllOrders(all);
        setOrders(all.filter((o) => o.imageCount > 0));
      })
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, [tenant?.clinicId]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    setUploadFiles((prev) => [...prev, ...files]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!uploadOrderId || uploadFiles.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        setUploadProgress(`Uploading ${i + 1} of ${uploadFiles.length}...`);
        const formData = new FormData();
        formData.append("file", uploadFiles[i]);
        formData.append("orderId", uploadOrderId);
        formData.append("clinicId", tenant?.clinicId ?? "");
        await fetch("/api/radiology/upload", { method: "POST", body: formData });
      }
      setUploadOpen(false);
      setUploadFiles([]);
      setUploadOrderId("");
      setUploadProgress("");
      refreshOrders();
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <PageLoader message="Loading images..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.patientName.toLowerCase().includes(q) || o.modality.toLowerCase().includes(q) || (o.bodyPart?.toLowerCase().includes(q) ?? false);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Image Gallery</h1>
          <p className="text-muted-foreground text-sm">Browse and upload radiology images</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button><Upload className="h-4 w-4 mr-2" /> Upload Images</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Radiology Images</DialogTitle>
              <DialogDescription>Upload X-ray, MRI, CT, or DICOM images to a study order.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Study Order</Label>
                <Select value={uploadOrderId} onValueChange={setUploadOrderId}>
                  <SelectTrigger><SelectValue placeholder="Select an order..." /></SelectTrigger>
                  <SelectContent>
                    {allOrders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.orderNumber} - {o.patientName} ({o.modality.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragOver ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20" : "border-muted-foreground/25 hover:border-muted-foreground/50"}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPEG, PNG, TIFF, DICOM, PDF (max 50 MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/dicom,.dcm,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {uploadFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Files ({uploadFiles.length})</Label>
                  {uploadFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2">
                      <span className="truncate mr-2">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                      <Button variant="ghost" size="sm" onClick={() => removeFile(i)} className="h-6 w-6 p-0">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {uploadProgress && (
                <p className="text-sm text-muted-foreground">{uploadProgress}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={uploading || !uploadOrderId || uploadFiles.length === 0}>
                {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Upload {uploadFiles.length} File{uploadFiles.length !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by patient, modality, body part..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((order) => (
          <Card key={order.id} className="overflow-hidden">
            <div className="relative aspect-video bg-muted flex items-center justify-center">
              {order.images.length > 0 && order.images[0].thumbnailUrl ? (
                <NextImage src={order.images[0].thumbnailUrl} alt={`${order.modality} - ${order.bodyPart}`} fill className="object-cover" />
              ) : order.images.length > 0 && order.images[0].fileUrl ? (
                <NextImage src={order.images[0].fileUrl} alt={`${order.modality} - ${order.bodyPart}`} fill className="object-cover" />
              ) : (
                <FileImage className="h-16 w-16 text-muted-foreground/30" />
              )}
            </div>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">{order.patientName}</p>
                <Badge variant="outline" className="text-xs uppercase">{order.modality}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {order.bodyPart ?? "N/A"} &middot; {order.imageCount} image{order.imageCount !== 1 ? "s" : ""} &middot; {new Date(order.createdAt).toLocaleDateString()}
              </p>
              <div className="flex gap-2">
                {order.images.length > 0 && order.images[0].fileUrl && (
                  <a
                    href={order.images[0].fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    <Eye className="h-3 w-3 mr-1" /> View
                  </a>
                )}
                {order.images.some((img) => img.isDicom) && (
                  <Link
                    href={`/radiology/viewer?study=${order.images.find((img) => img.dicomStudyUid)?.dicomStudyUid ?? ""}&order=${order.id}`}
                    className="inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" /> DICOM
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No images found</p>
          <Button variant="outline" className="mt-4" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Upload your first images
          </Button>
        </div>
      )}
    </div>
  );
}
