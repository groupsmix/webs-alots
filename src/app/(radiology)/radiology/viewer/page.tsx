"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Monitor, Info } from "lucide-react";

export default function DicomViewerPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">DICOM Viewer</h1>
        <p className="text-muted-foreground text-sm">View medical images in DICOM format</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12 space-y-4">
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

            <div className="mt-8 p-4 bg-muted/50 rounded-lg text-left max-w-lg mx-auto">
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
        </CardContent>
      </Card>
    </div>
  );
}
