"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, ToggleLeft, ToggleRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  sectionDefinitions,
  defaultSectionVisibility,
  mergeSectionVisibility,
  type SectionVisibility,
  type SectionKey,
} from "@/lib/section-visibility";

export default function SectionsPage() {
  const [visibility, setVisibility] =
    useState<SectionVisibility>(defaultSectionVisibility);
  const [savedState, setSavedState] =
    useState<SectionVisibility>(defaultSectionVisibility);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((data) => {
        const merged = mergeSectionVisibility(data.section_visibility);
        setVisibility(merged);
        setSavedState(merged);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: SectionKey) => {
    const def = sectionDefinitions.find((s) => s.key === key);
    if (def?.alwaysOn) return;
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section_visibility: visibility }),
      });
      setSavedState(visibility);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    JSON.stringify(visibility) !== JSON.stringify(savedState);

  const enabledCount = Object.values(visibility).filter(Boolean).length;

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Section Control</h1>
        <p className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading section settings...
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Section Control</h1>
          <p className="text-sm text-muted-foreground">
            Toggle sections on or off on your public homepage. The order stays
            fixed per template.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {enabledCount} of {sectionDefinitions.length} sections enabled
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : hasChanges ? "Save Changes" : "Saved"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Homepage Sections</CardTitle>
          <CardDescription>
            Sections are displayed in the order listed below. Toggle each
            section to show or hide it on your public site.
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
                      <span className="text-sm font-medium">
                        {section.label}
                      </span>
                      {isAlwaysOn && (
                        <Badge variant="secondary" className="text-[10px]">
                          Always on
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {section.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggle(section.key)}
                    disabled={isAlwaysOn}
                    className={`flex-shrink-0 transition-colors ${
                      isAlwaysOn
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer"
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
