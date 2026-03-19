import { Upload, FileText, Image, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const documents = [
  { id: "doc1", name: "Blood Test Results", type: "analysis", date: "2026-03-15", icon: FileText },
  { id: "doc2", name: "Chest X-Ray", type: "radiology", date: "2026-02-20", icon: Image },
  { id: "doc3", name: "CNSS Insurance Card", type: "insurance", date: "2026-01-10", icon: CreditCard },
  { id: "doc4", name: "ECG Report", type: "analysis", date: "2025-12-05", icon: FileText },
];

const typeVariant: Record<string, "default" | "secondary" | "outline"> = {
  analysis: "default",
  radiology: "secondary",
  insurance: "outline",
};

export default function PatientDocumentsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Documents</h1>
        <Button>
          <Upload className="h-4 w-4 mr-1" />
          Upload Document
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {documents.map((doc) => (
          <Card key={doc.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <doc.icon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{doc.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={typeVariant[doc.type]}>{doc.type}</Badge>
                  <span className="text-xs text-muted-foreground">{doc.date}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
