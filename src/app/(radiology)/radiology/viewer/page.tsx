"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Monitor, Info, FileImage, Scan } from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import { fetchRadiologyOrders } from "@/lib/data/client";
import type { RadiologyOrderView } from "@/lib/data/client";

export default function DicomViewerPage() {
  const [orders, setOrders] = useState<RadiologyOrderView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRadiologyOrders(clinicConfig.clinicId)
      .then((all) => setOrders(all.filter((o) => o.imageCount > 0)))
      .finally(() => setLoading(false));
  }, []);

  const dicomOrders = orders.filter((o) =>
    o.images.some((img) => img.isDicom || img.dicomStudyUid)
  );
  const nonDicomOrders = orders.filter(
    (o) => !o.images.some((img) => img.isDicom || img.dicomStudyUid)
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">DICOM Viewer</h1>
        <p className="text-muted-foreground text-sm">View medical images in DICOM format</p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="text-center py-8 space-y-4">
            <Monitor className="h-16 w-16 text-indigo-600 mx-auto" />
            <h2 className="text-xl font-semibold">DICOM Viewer Integration</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Connect to an external DICOM viewer such as OHIF Viewer or Cornerstone.js
              to view medical images with full diagnostic tools.
            </p>
            <div className="flex items-center justify-center gap-3 pt-4">
              <a
                href="https://viewer.ohif.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open OHIF Viewer
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Loading studies...</div>
        </div>
      ) : (
        <>
          {dicomOrders.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">DICOM Studies</h3>
              <div className="space-y-3">
                {dicomOrders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                            <Scan className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium">{order.patientName}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.orderNumber} &middot; {order.modality.toUpperCase()} &middot; {order.bodyPart ?? "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{order.imageCount} image{order.imageCount !== 1 ? "s" : ""}</Badge>
                          {order.images.find((img) => img.dicomStudyUid) && (
                            <a
                              href={`https://viewer.ohif.org/viewer?StudyInstanceUIDs=${order.images.find((img) => img.dicomStudyUid)?.dicomStudyUid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md bg-indigo-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-indigo-700 transition-colors"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" /> Open in OHIF
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {nonDicomOrders.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Standard Images</h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {nonDicomOrders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <FileImage className="h-8 w-8 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{order.patientName}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.modality.toUpperCase()} &middot; {order.imageCount} image{order.imageCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {order.images[0]?.fileUrl && (
                          <a
                            href={order.images[0].fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted transition-colors"
                          >
                            View
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {orders.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <FileImage className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No studies with images found</p>
                  <p className="text-xs text-muted-foreground mt-1">Upload images via the Image Gallery page</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="mt-6 p-4 bg-muted/50 rounded-lg text-left max-w-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-sm mb-1">Integration Notes</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>&bull; Upload DICOM files via the Image Gallery</li>
              <li>&bull; DICOM Study UIDs are stored with each image</li>
              <li>&bull; Configure your PACS/DICOMweb endpoint in clinic settings</li>
              <li>&bull; Supported viewers: OHIF, Cornerstone.js, Horos</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
