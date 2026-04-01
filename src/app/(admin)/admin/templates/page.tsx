"use client";

import {
  AlertCircle,
  Check,
  Eye,
  Layout,
  Loader2,
  Palette,
  Save,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { VerticalId } from "@/lib/config/verticals";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import {
  presetList,
  type TemplatePreset,
} from "@/lib/template-presets";
import { templateList, type TemplateId } from "@/lib/templates";

const VERTICAL_LABELS: Record<VerticalId, string> = {
  healthcare: "Healthcare",
  beauty: "Beauty & Wellness",
  restaurant: "Restaurant",
  fitness: "Fitness",
  veterinary: "Veterinary",
};

const VERTICAL_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All Presets" },
  ...Object.entries(VERTICAL_LABELS).map(([value, label]) => ({ value, label })),
];

export default function TemplatesPage() {
  const { data: initialTemplate, loading, error } = useAsyncData(
    (signal) =>
      fetch("/api/branding", { signal })
        .then((r) => {
          if (!r.ok) throw new Error(`Failed to load templates (${r.status})`);
          return r.json();
        })
        .then((data) => (data.template_id ?? "modern") as TemplateId),
    "modern" as TemplateId,
  );
  const [selected, setSelected] = useState<TemplateId>("modern");
  const [saved, setSaved] = useState<TemplateId>("modern");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  // Preset state
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);
  const [appliedPreset, setAppliedPreset] = useState<string | null>(null);
  const [previewPreset, setPreviewPreset] = useState<TemplatePreset | null>(null);

  // Sync initial data once loaded
  if (!initialized && !loading && !error) {
    setSelected(initialTemplate);
    setSaved(initialTemplate);
    setInitialized(true);
  }

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

  const handleApplyPreset = async (preset: TemplatePreset) => {
    setApplyingPreset(preset.id);
    try {
      const res = await fetch("/api/branding/apply-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: preset.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error ?? "Failed to apply preset");
        return;
      }

      setAppliedPreset(preset.id);
      setSelected(preset.templateId);
      setSaved(preset.templateId);
      setTimeout(() => setAppliedPreset(null), 3000);
    } finally {
      setApplyingPreset(null);
    }
  };

  const hasChanges = selected !== saved;

  const filteredPresets =
    verticalFilter === "all"
      ? presetList
      : presetList.filter((p) => p.vertical === verticalFilter);

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

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Layout Templates</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Failed to load templates</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Templates" }]} />
          <h1 className="text-2xl font-bold">Layout Templates</h1>
          <p className="text-sm text-muted-foreground">
            Choose a preset for instant setup, or pick a base template and
            customize in the branding editor.
          </p>
        </div>
      </div>

      <Tabs defaultValue="presets">
        <TabsList className="mb-6">
          <TabsTrigger value="presets">
            <Sparkles className="h-4 w-4 mr-2" />
            Presets
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Layout className="h-4 w-4 mr-2" />
            Base Templates
          </TabsTrigger>
        </TabsList>

        {/* Presets Tab */}
        <TabsContent value="presets">
          {/* Vertical filter */}
          <div className="flex flex-wrap gap-2 mb-6">
            {VERTICAL_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={verticalFilter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setVerticalFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {filteredPresets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No presets available for this vertical.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPresets.map((preset) => {
                const isApplying = applyingPreset === preset.id;
                const justApplied = appliedPreset === preset.id;
                return (
                  <Card
                    key={preset.id}
                    className="relative transition-all hover:shadow-md"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Wand2 className="h-4 w-4" />
                          {preset.name}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {VERTICAL_LABELS[preset.vertical]}
                        </Badge>
                      </div>
                      <CardDescription>{preset.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* Color preview */}
                      <div className="rounded-lg border p-3 mb-3 space-y-2">
                        <div className="flex gap-2 items-center">
                          <div
                            className="h-6 w-6 rounded-full border"
                            style={{ backgroundColor: preset.theme.primaryColor }}
                          />
                          <div
                            className="h-6 w-6 rounded-full border"
                            style={{ backgroundColor: preset.theme.secondaryColor }}
                          />
                          <div
                            className="h-6 w-6 rounded-full border"
                            style={{ backgroundColor: preset.theme.accentColor }}
                          />
                          <span className="text-xs text-muted-foreground ml-auto">
                            {preset.templateId}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground mb-3">
                        {preset.preview}
                      </p>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setPreviewPreset(preset)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={isApplying}
                          onClick={() => handleApplyPreset(preset)}
                        >
                          {justApplied ? (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1" />
                              Applied!
                            </>
                          ) : isApplying ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              Applying...
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-3.5 w-3.5 mr-1" />
                              Apply
                            </>
                          )}
                        </Button>
                      </div>
                      <a
                        href={`/admin/branding?preset=${preset.id}`}
                        className="mt-2 block"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs"
                        >
                          <Palette className="h-3.5 w-3.5 mr-1" />
                          Customize
                        </Button>
                      </a>

                      {justApplied && (
                        <p className="text-xs text-center text-green-600 mt-2">
                          Preset applied! Your site is updated.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Customize CTA */}
          <div className="mt-6 rounded-lg border-2 border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Want more control? Fine-tune colors, fonts, and images in the
              branding editor.
            </p>
            <a href="/admin/branding">
              <Button variant="outline">
                <Palette className="h-4 w-4 mr-2" />
                Open Branding Editor
              </Button>
            </a>
          </div>
        </TabsContent>

        {/* Base Templates Tab */}
        <TabsContent value="templates">
          <div className="flex justify-end mb-4">
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
        </TabsContent>
      </Tabs>

      {/* Preview Modal */}
      {previewPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold text-lg">
                {previewPreset.name}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewPreset(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              {/* Hero preview */}
              <div
                className="rounded-lg p-6 text-center text-white"
                style={{
                  background: `linear-gradient(135deg, ${previewPreset.theme.primaryColor}, ${previewPreset.theme.secondaryColor})`,
                }}
              >
                <h3 className="text-xl font-bold mb-2">
                  {previewPreset.hero.title}
                </h3>
                <p className="text-sm opacity-90">
                  {previewPreset.hero.subtitle}
                </p>
              </div>

              {/* Arabic preview */}
              <div
                className="rounded-lg p-6 text-center text-white"
                dir="rtl"
                style={{
                  background: `linear-gradient(135deg, ${previewPreset.theme.secondaryColor}, ${previewPreset.theme.primaryColor})`,
                }}
              >
                <h3 className="text-xl font-bold mb-2">
                  {previewPreset.hero.titleAr}
                </h3>
                <p className="text-sm opacity-90">
                  {previewPreset.hero.subtitleAr}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium w-24">Colors:</span>
                  <div className="flex gap-2">
                    <div
                      className="h-6 w-6 rounded-full border"
                      style={{ backgroundColor: previewPreset.theme.primaryColor }}
                      title={previewPreset.theme.primaryColor}
                    />
                    <div
                      className="h-6 w-6 rounded-full border"
                      style={{ backgroundColor: previewPreset.theme.secondaryColor }}
                      title={previewPreset.theme.secondaryColor}
                    />
                    <div
                      className="h-6 w-6 rounded-full border"
                      style={{ backgroundColor: previewPreset.theme.accentColor }}
                      title={previewPreset.theme.accentColor}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium w-24">Template:</span>
                  <Badge variant="secondary">{previewPreset.templateId}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium w-24">Vertical:</span>
                  <Badge variant="outline">
                    {VERTICAL_LABELS[previewPreset.vertical]}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm font-medium">Sections:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(previewPreset.sections).map(
                      ([key, enabled]) => (
                        <Badge
                          key={key}
                          variant={enabled ? "default" : "outline"}
                          className="text-xs"
                        >
                          {key}
                        </Badge>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPreviewPreset(null)}
              >
                Close
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  handleApplyPreset(previewPreset);
                  setPreviewPreset(null);
                }}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Apply Preset
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
