"use client";

import { Save, ToggleLeft, ToggleRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  sectionDefinitions,
  type SectionVisibility,
  type SectionKey,
} from "@/lib/section-visibility";

interface SectionsFormProps {
  initialVisibility: SectionVisibility;
}

export default function SectionsForm({ initialVisibility }: SectionsFormProps) {
  const [visibility, setVisibility] = useState<SectionVisibility>(initialVisibility);
  const [savedState, setSavedState] = useState<SectionVisibility>(initialVisibility);
  const [saving, setSaving] = useState(false);

  const toggle = (key: SectionKey) => {
    const def = sectionDefinitions.find((s) => s.key === key);
    if (def?.alwaysOn) return;
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section_visibility: visibility }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error ?? "Failed to save section settings");
        return;
      }
      setSavedState(visibility);
    } catch {
      alert("Failed to save section settings");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(visibility) !== JSON.stringify(savedState);
  const enabledCount = Object.values(visibility).filter(Boolean).length;

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Sections" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Section Control</h1>
          <p className="text-sm text-muted-foreground">
            Toggle sections on or off on your public homepage. The order stays fixed per template.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {enabledCount} of {sectionDefinitions.length} sections enabled
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          <Save className="h-4 w-4 me-2" />
          {saving ? "Saving..." : hasChanges ? "Save Changes" : "Saved"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Homepage Sections</CardTitle>
          <CardDescription>
            Sections are displayed in the order listed below. Toggle each section to show or hide it
            on your public site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {sectionDefinitions.map((section) => {
              const isOn = visibility[section.key];
              const isAlwaysOn = section.alwaysOn === true;

              return (
                <div
                  key={section.key}
                  className={`flex items-center justify-between py-4 first:pt-0 last:pb-0 ${
                    !isOn && !isAlwaysOn ? "opacity-50" : ""
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{section.label}</span>
                      {isAlwaysOn && (
                        <Badge variant="secondary" className="text-[10px]">
                          Always on
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{section.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggle(section.key)}
                    disabled={isAlwaysOn}
                    className={`flex-shrink-0 transition-colors ${
                      isAlwaysOn ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                    }`}
                    aria-label={`Toggle ${section.label}`}
                  >
                    {isOn ? (
                      <ToggleRight className="h-8 w-8 text-primary" />
                    ) : (
                      <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
