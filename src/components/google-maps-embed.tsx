"use client";

/**
 * Google Maps Embed Component
 *
 * Renders a Google Maps iframe embed for clinic location display.
 * Uses the embed URL from the website configuration.
 */

interface GoogleMapsEmbedProps {
  embedUrl: string;
  address?: string;
  height?: number;
  className?: string;
}

export function GoogleMapsEmbed({
  embedUrl,
  address,
  height = 400,
  className,
}: GoogleMapsEmbedProps) {
  if (!embedUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg ${className ?? ""}`}
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">
          Map not configured. Add a Google Maps embed URL in settings.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden ${className ?? ""}`}>
      <iframe
        src={embedUrl}
        width="100%"
        height={height}
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={address ?? "Clinic Location"}
        className="w-full"
      />
      {address && (
        <div className="absolute bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-4 py-2">
          <p className="text-sm font-medium">{address}</p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            Open in Google Maps →
          </a>
        </div>
      )}
    </div>
  );
}
