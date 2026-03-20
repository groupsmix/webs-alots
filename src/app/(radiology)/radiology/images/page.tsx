"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Image, ExternalLink, Eye, FileImage } from "lucide-react";
import Link from "next/link";
import { clinicConfig } from "@/config/clinic.config";
import { fetchRadiologyOrders } from "@/lib/data/client";
import type { RadiologyOrderView } from "@/lib/data/client";

export default function RadiologyImagesPage() {
  const [orders, setOrders] = useState<RadiologyOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchRadiologyOrders(clinicConfig.clinicId)
      .then((all) => setOrders(all.filter((o) => o.imageCount > 0)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading images...</div>
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
          <p className="text-muted-foreground text-sm">Browse uploaded radiology images</p>
        </div>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by patient, modality, body part..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((order) => (
          <Card key={order.id} className="overflow-hidden">
            <div className="aspect-video bg-muted flex items-center justify-center">
              {order.images.length > 0 && order.images[0].thumbnailUrl ? (
                <img src={order.images[0].thumbnailUrl} alt={`${order.modality} - ${order.bodyPart}`} className="w-full h-full object-cover" />
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
                {order.images.some((img) => img.dicomStudyUid) && (
                  <Link
                    href={`/radiology/viewer?study=${order.images[0].dicomStudyUid ?? ""}`}
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
          <Image className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No images found</p>
        </div>
      )}
    </div>
  );
}
