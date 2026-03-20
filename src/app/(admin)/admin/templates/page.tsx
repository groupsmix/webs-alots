"use client";

import { useEffect, useState } from "react";
import { Check, Layout, Loader2, Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { templateList, type TemplateId } from "@/lib/templates";

export default function TemplatesPage() {
  const [selected, setSelected] = useState<TemplateId>("modern");
  const [saved, setSaved] = useState<TemplateId>("modern");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((data) => {
        const id = (data.template_id ?? "modern") as TemplateId;
        setSelected(id);
        setSaved(id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: selected }),
      });
      setSaved(selected);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = selected !== saved;

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Layout Templates</h1>
        <p className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading templates...
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Layout Templates</h1>
          <p className="text-sm text-muted-foreground">
            Choose a homepage layout for your clinic website. The template
            controls the visual style — your content stays the same.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : hasChanges ? "Save Template" : "Saved"}
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {templateList.map((tmpl) => {
          const isSelected = selected === tmpl.id;
          return (
            <Card
              key={tmpl.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected
                  ? "ring-2 ring-primary shadow-md"
                  : "hover:ring-1 hover:ring-border"
              }`}
              onClick={() => setSelected(tmpl.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layout className="h-4 w-4" />
                    {tmpl.name}
                  </CardTitle>
                  {isSelected && (
                    <Badge variant="default" className="gap-1">
                      <Check className="h-3 w-3" />
                      Selected
                    </Badge>
                  )}
                </div>
                <CardDescription>{tmpl.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Template preview card */}
                <div
                  className={`rounded-lg border p-4 text-xs space-y-2 ${tmpl.wrapperClass}`}
                >
                  {/* Mini hero preview */}
                  <div
                    className={`h-12 rounded flex items-center justify-center text-[10px] font-medium ${
                      tmpl.bgMode === "dark"
                        ? "bg-white/10 text-white/80"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    Hero — {tmpl.heroStyle}
                  </div>
                  {/* Mini cards preview */}
                  <div className="grid grid-cols-3 gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-8 rounded flex items-center justify-center text-[9px] ${
                          tmpl.cardStyle === "shadow"
                            ? "shadow-sm bg-white dark:bg-gray-800"
                            : tmpl.cardStyle === "bordered"
                              ? "border bg-transparent"
                              : tmpl.cardStyle === "elevated"
                                ? "shadow-md bg-white dark:bg-gray-800"
                                : tmpl.bgMode === "dark"
                                  ? "bg-white/5"
                                  : "bg-gray-100"
                        }`}
                      >
                        Card {i}
                      </div>
                    ))}
                  </div>
                  {/* Properties */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[9px] text-primary">
                      {tmpl.borderRadius} radius
                    </span>
                    <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[9px] text-primary">
                      {tmpl.bgMode} bg
                    </span>
                    {tmpl.rtl && (
                      <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[9px] text-primary">
                        RTL
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {tmpl.preview}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
