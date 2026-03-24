"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, FileStack, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/components/tenant-provider";
import { fetchRadiologyTemplates } from "@/lib/data/client";
import type { RadiologyTemplateView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

export default function RadiologyTemplatesPage() {
  const tenant = useTenant();
  const [templates, setTemplates] = useState<RadiologyTemplateView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchRadiologyTemplates(tenant?.clinicId ?? "")
      .then((d) => { if (!controller.signal.aborted) setTemplates(d); })
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, [tenant?.clinicId]);

  if (loading) {
    return <PageLoader message="Loading templates..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }

  const filtered = templates.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.modality?.toLowerCase().includes(q) ?? false) || (t.bodyPart?.toLowerCase().includes(q) ?? false);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Report Templates</h1>
          <p className="text-muted-foreground text-sm">Reusable radiology report templates</p>
        </div>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((template) => (
          <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setExpandedId(expandedId === template.id ? null : template.id)}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <FileStack className="h-5 w-5 text-indigo-600" />
                  <p className="font-medium">{template.name}</p>
                </div>
                <Badge variant="outline" className="text-xs uppercase">{template.modality}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {template.bodyPart ?? "General"} &middot; {template.language}
              </p>

              {expandedId === template.id && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  {template.sections.map((section, i) => (
                    <div key={i} className="text-sm">
                      <p className="font-medium text-xs text-muted-foreground uppercase mb-1">{section.title}</p>
                      <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded p-2">{section.defaultContent}</p>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    const text = template.sections.map((s) => `${s.title}:\n${s.defaultContent}`).join("\n\n");
                    navigator.clipboard.writeText(text);
                  }}>
                    <Copy className="h-3 w-3 mr-1" /> Copy Template
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <FileStack className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No templates found</p>
        </div>
      )}
    </div>
  );
}
