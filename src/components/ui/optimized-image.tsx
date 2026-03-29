import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends Omit<ImageProps, "alt"> {
  alt: string;
  fallback?: string;
  aspectRatio?: "square" | "video" | "portrait" | "auto";
}

const aspectClasses: Record<string, string> = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[3/4]",
  auto: "",
};

/**
 * Optimized image wrapper using next/image with:
 * - Automatic lazy loading
 * - Blur placeholder support
 * - Aspect ratio presets
 * - Fallback for missing images
 *
 * For CDN configuration, set `images.remotePatterns` in next.config.ts
 * to allow your R2/CDN domains.
 */
export function OptimizedImage({
  alt,
  className,
  aspectRatio = "auto",
  fallback,
  ...props
}: OptimizedImageProps) {
  return (
    <div className={cn("overflow-hidden", aspectClasses[aspectRatio])}>
      <Image
        alt={alt}
        loading="lazy"
        className={cn("h-full w-full object-cover", className)}
        onError={(e) => {
          if (fallback) {
            const target = e.currentTarget;
            target.src = fallback;
          }
        }}
        {...props}
      />
    </div>
  );
}
