"use client";

import { cn } from "@/lib/utils";

export interface ColorPaletteProps {
  colors: string[];
  selected: string[];
  onChange: (colors: string[]) => void;
}

const presetPalettes: Record<string, string[]> = {
  medical: ["#1E40AF", "#3B82F6", "#DBEAFE", "#FFFFFF"],
  dental: ["#FFFFFF", "#F0F9FF", "#0EA5E9", "#0C4A6E"],
  pharmacy: ["#065F46", "#10B981", "#D1FAE5", "#FFFFFF"],
  modern: ["#7C3AED", "#A78BFA", "#EDE9FE", "#FFFFFF"],
  warm: ["#DC2626", "#F97316", "#FEF3C7", "#FFFFFF"],
  neutral: ["#1F2937", "#6B7280", "#F3F4F6", "#FFFFFF"],
};

export function ColorPalette({ colors, selected, onChange }: ColorPaletteProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => {
              if (selected.includes(color)) {
                onChange(selected.filter((c) => c !== color));
              } else {
                onChange([...selected, color]);
              }
            }}
            className={cn(
              "h-8 w-8 rounded-full border-2 transition-all",
              selected.includes(color)
                ? "border-primary ring-2 ring-primary/30 scale-110"
                : "border-transparent hover:scale-105",
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(presetPalettes).map(([name, palette]) => (
          <button
            key={name}
            type="button"
            onClick={() => onChange(palette)}
            className={cn(
              "flex items-center gap-0.5 rounded-md border px-2 py-1 text-xs capitalize transition-colors",
              JSON.stringify(selected) === JSON.stringify(palette)
                ? "border-primary bg-primary/10 text-primary"
                : "border-muted hover:border-primary/50",
            )}
          >
            <span className="flex gap-0.5">
              {palette.map((c) => (
                <span
                  key={c}
                  className="h-3 w-3 rounded-full border border-border/50"
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
            <span className="ml-1">{name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export { presetPalettes };
