"use client";

import { Monitor, Smartphone, Tablet } from "lucide-react";
import { useState } from "react";
import { ColorPalette } from "@/components/agent-builder/color-palette";
import { TemplateClassic } from "@/components/agent-builder/template-classic";
import { TemplateMinimal } from "@/components/agent-builder/template-minimal";
import { TemplateModern } from "@/components/agent-builder/template-modern";
import type { ClinicConfig, DevicePreview, TemplateStyle } from "@/components/agent-builder/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DesignPreviewProps {
  config: ClinicConfig;
  onConfigChange: (config: ClinicConfig) => void;
}

const deviceWidths: Record<DevicePreview, string> = {
  desktop: "w-full",
  tablet: "w-[320px]",
  mobile: "w-[240px]",
};

const templateOptions: { value: TemplateStyle; label: string }[] = [
  { value: "modern", label: "Modern" },
  { value: "classic", label: "Classic" },
  { value: "minimal", label: "Minimal" },
];

export function DesignPreview({ config, onConfigChange }: DesignPreviewProps) {
  const [device, setDevice] = useState<DevicePreview>("desktop");

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-1">
          {(
            [
              { key: "desktop", icon: Monitor },
              { key: "tablet", icon: Tablet },
              { key: "mobile", icon: Smartphone },
            ] as const
          ).map(({ key, icon: Icon }) => (
            <Button
              key={key}
              variant={device === key ? "default" : "ghost"}
              size="sm"
              onClick={() => setDevice(key)}
              className="h-7 w-7 p-0"
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {templateOptions.map((opt) => (
            <Button
              key={opt.value}
              variant={config.template === opt.value ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-[10px]"
              onClick={() => onConfigChange({ ...config, template: opt.value })}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Color Palette */}
      <div className="border-b px-4 py-2">
        <ColorPalette
          colors={config.colors}
          selected={config.colors}
          onChange={(colors) => onConfigChange({ ...config, colors })}
        />
      </div>

      {/* Preview */}
      <div className="flex flex-1 items-start justify-center overflow-auto bg-muted/30 p-4">
        <div
          className={cn(
            "mx-auto rounded-lg border bg-background shadow-lg transition-all",
            deviceWidths[device],
          )}
        >
          {config.template === "modern" && <TemplateModern config={config} />}
          {config.template === "classic" && <TemplateClassic config={config} />}
          {config.template === "minimal" && <TemplateMinimal config={config} />}
        </div>
      </div>
    </div>
  );
}
