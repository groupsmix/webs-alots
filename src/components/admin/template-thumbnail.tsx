import type { CSSProperties } from "react";
import { publicCardClass, templateRadius } from "@/lib/public-theme";
import type { TemplateDefinition } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * A small, structurally-accurate preview of a layout template for the admin
 * template picker. Unlike a static description, it reflects the template's
 * real hero layout, card style, corner radius and background mode — so two
 * templates actually look different in the picker, matching how they render
 * on the public site.
 */
export function TemplateThumbnail({ template }: { template: TemplateDefinition }) {
  const dark = template.bgMode === "dark";
  const surface = dark ? "bg-white/10" : "bg-primary/10";
  const line = dark ? "bg-white/25" : "bg-primary/25";
  const faint = dark ? "bg-white/10" : "bg-foreground/10";

  const style = { "--radius": templateRadius(template.borderRadius) } as CSSProperties;
  const miniCard = cn("h-8", publicCardClass(template.cardStyle));

  return (
    <div
      style={style}
      dir={template.rtl ? "rtl" : "ltr"}
      className={cn(
        "overflow-hidden rounded-lg border p-2.5 text-[10px] space-y-2",
        template.wrapperClass,
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className={cn("h-2 w-10 rounded-full", line)} />
        <div className="flex gap-1">
          <div className={cn("h-1.5 w-4 rounded-full", faint)} />
          <div className={cn("h-1.5 w-4 rounded-full", faint)} />
          <div className={cn("h-1.5 w-4 rounded-full", faint)} />
        </div>
      </div>

      {/* Hero — layout reflects heroStyle */}
      {template.heroStyle === "split" ? (
        <div className={cn("grid grid-cols-2 gap-2 rounded p-2", surface)}>
          <div className="space-y-1">
            <div className={cn("h-2 w-full rounded-full", line)} />
            <div className={cn("h-1.5 w-3/4 rounded-full", faint)} />
            <div className="h-3 w-10 rounded bg-primary" />
          </div>
          <div className={cn("rounded", faint)} />
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col items-center gap-1 rounded p-3",
            template.heroStyle === "overlay" ? "bg-primary" : surface,
          )}
        >
          <div
            className={cn(
              "h-2 w-2/3 rounded-full",
              template.heroStyle === "overlay" ? "bg-primary-foreground/80" : line,
            )}
          />
          <div
            className={cn(
              "h-1.5 w-1/2 rounded-full",
              template.heroStyle === "overlay" ? "bg-primary-foreground/50" : faint,
            )}
          />
          <div
            className={cn(
              "mt-1 h-3 w-10 rounded",
              template.heroStyle === "overlay" ? "bg-primary-foreground" : "bg-primary",
            )}
          />
        </div>
      )}

      {/* Card row — reflects cardStyle + radius */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className={miniCard} />
        <div className={miniCard} />
        <div className={miniCard} />
      </div>
    </div>
  );
}
