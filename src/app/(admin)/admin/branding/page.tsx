"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  Palette,
  Upload,
  Save,
  Image as ImageIcon,
  Type,
  Building2,
  Phone,
  MapPin,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageLoader } from "@/components/ui/page-loader";
import { useAsyncData } from "@/lib/hooks/use-async-data";

interface BrandingState {
  name: string;
  tagline: string;
  phone: string;
  address: string;
  logo_url: string | null;
  favicon_url: string | null;
  cover_photo_url: string | null;
  primary_color: string;
  secondary_color: string;
  heading_font: string;
  body_font: string;
  hero_image_url: string | null;
}

/**
 * Calculate WCAG 2.1 relative luminance from a hex color.
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function getLuminance(hex: string): number {
  const rgb = hex
    .replace(/^#/, "")
    .match(/.{2}/g)
    ?.map((c) => {
      const v = parseInt(c, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
  if (!rgb || rgb.length < 3) return 0;
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/** WCAG contrast ratio between two hex colors. */
function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Returns true if the color pair meets WCAG AA for normal text (4.5:1). */
function meetsWCAGAA(fg: string, bg: string): boolean {
  return getContrastRatio(fg, bg) >= 4.5;
}

/**
 * Darken or lighten a hex color until it meets WCAG AA (4.5:1) against white.
 * Iteratively adjusts luminance by mixing toward black (Issue 8).
 */
function suggestAccessibleColor(hex: string): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  // Darken step-by-step until we meet contrast against white
  for (let i = 0; i < 100; i++) {
    const candidate = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    if (getContrastRatio("#ffffff", candidate) >= 4.5) {
      return candidate;
    }
    // Mix 5% toward black each step
    r = Math.round(r * 0.95);
    g = Math.round(g * 0.95);
    b = Math.round(b * 0.95);
  }
  return "#000000";
}

const FONT_OPTIONS = [
  "Geist",
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Nunito",
  "Source Sans Pro",
];

const DEFAULT_BRANDING: BrandingState = {
  name: "",
  tagline: "",
  phone: "",
  address: "",
  logo_url: null,
  favicon_url: null,
  cover_photo_url: null,
  primary_color: "#1E4DA1",
  secondary_color: "#0F6E56",
  heading_font: "Geist",
  body_font: "Geist",
  hero_image_url: null,
};

export default function BrandingPage() {
  const { data: initialBranding, loading, error } = useAsyncData(
    (signal) =>
      fetch("/api/branding", { signal })
        .then((r) => {
          if (!r.ok) throw new Error(`Failed to load branding (${r.status})`);
          return r.json();
        })
        .then((data) => ({
          name: data.name ?? "",
          tagline: data.tagline ?? "",
          phone: data.phone ?? "",
          address: data.address ?? "",
          logo_url: data.logo_url ?? null,
          favicon_url: data.favicon_url ?? null,
          cover_photo_url: data.cover_photo_url ?? null,
          primary_color: data.primary_color ?? "#1E4DA1",
          secondary_color: data.secondary_color ?? "#0F6E56",
          heading_font: data.heading_font ?? "Geist",
          body_font: data.body_font ?? "Geist",
          hero_image_url: data.hero_image_url ?? null,
        })),
    DEFAULT_BRANDING,
  );
  const [branding, setBranding] = useState<BrandingState>(DEFAULT_BRANDING);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // Sync initial data once loaded
  if (!initialized && !loading && !error) {
    setBranding(initialBranding);
    setInitialized(true);
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: branding.name,
          tagline: branding.tagline,
          phone: branding.phone,
          address: branding.address,
          primary_color: branding.primary_color,
          secondary_color: branding.secondary_color,
          heading_font: branding.heading_font,
          body_font: branding.body_font,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (
    field: "logo" | "favicon" | "hero" | "cover",
    file: File,
  ) => {
    setUploading(field);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("field", field);

      const res = await fetch("/api/branding", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Upload failed");
        return;
      }

      const { url } = await res.json();
      const urlField =
        field === "logo"
          ? "logo_url"
          : field === "favicon"
            ? "favicon_url"
            : field === "cover"
              ? "cover_photo_url"
              : "hero_image_url";
      setBranding((prev) => ({ ...prev, [urlField]: url }));
    } finally {
      setUploading(null);
    }
  };

  const onFileChange =
    (field: "logo" | "favicon" | "hero" | "cover") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(field, file);
    };

  if (loading) {
    return <PageLoader message="Loading branding settings..." />;
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Branding</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Failed to load branding settings</p>
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
          <h1 className="text-2xl font-bold">Branding</h1>
          <p className="text-sm text-muted-foreground">
            Customize your clinic&apos;s look and feel. Changes apply instantly
            to your public website.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="info">
            <Building2 className="h-4 w-4 mr-2" />
            Clinic Info
          </TabsTrigger>
          <TabsTrigger value="images">
            <ImageIcon className="h-4 w-4 mr-2" />
            Images
          </TabsTrigger>
          <TabsTrigger value="colors">
            <Palette className="h-4 w-4 mr-2" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="fonts">
            <Type className="h-4 w-4 mr-2" />
            Fonts
          </TabsTrigger>
        </TabsList>

        {/* ── Clinic Info Tab ── */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Clinic Information
              </CardTitle>
              <CardDescription>
                Name, tagline, phone, and address displayed on your public site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Clinic Name</Label>
                  <Input
                    value={branding.name}
                    onChange={(e) =>
                      setBranding((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="My Clinic"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input
                    value={branding.tagline}
                    onChange={(e) =>
                      setBranding((p) => ({ ...p, tagline: e.target.value }))
                    }
                    placeholder="Your Health, Our Priority"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    Phone
                  </Label>
                  <Input
                    value={branding.phone}
                    onChange={(e) =>
                      setBranding((p) => ({ ...p, phone: e.target.value }))
                    }
                    placeholder="+212 6 12 34 56 78"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Address
                  </Label>
                  <Textarea
                    value={branding.address}
                    onChange={(e) =>
                      setBranding((p) => ({ ...p, address: e.target.value }))
                    }
                    placeholder="123 Bd Mohammed V, Casablanca"
                    rows={2}
                  />
                </div>
              </div>

              {/* Working Hours Display */}
              <div className="border-t pt-4 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Working Hours</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Working hours are managed from the{" "}
                  <a
                    href="/admin/working-hours"
                    className="text-primary underline"
                  >
                    Working Hours
                  </a>{" "}
                  page and are automatically displayed on your public site.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Images Tab ── */}
        <TabsContent value="images">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Logo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Logo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {branding.logo_url && (
                    <div className="border rounded-lg p-4 flex items-center justify-center bg-muted/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={branding.logo_url}
                        alt="Clinic logo"
                        className="max-h-24 max-w-full object-contain"
                      />
                    </div>
                  )}
                  <input
                    ref={logoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onFileChange("logo")}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={uploading === "logo"}
                    onClick={() => logoRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading === "logo" ? "Uploading..." : "Upload Logo"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Favicon */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Favicon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {branding.favicon_url && (
                    <div className="border rounded-lg p-4 flex items-center justify-center bg-muted/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={branding.favicon_url}
                        alt="Clinic favicon"
                        className="max-h-16 max-w-full object-contain"
                      />
                    </div>
                  )}
                  <input
                    ref={faviconRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onFileChange("favicon")}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={uploading === "favicon"}
                    onClick={() => faviconRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading === "favicon" ? "Uploading..." : "Upload Favicon"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Hero Image */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Hero Image
                </CardTitle>
                <CardDescription>
                  Main image in the homepage hero section
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {branding.hero_image_url && (
                    <div className="border rounded-lg p-4 flex items-center justify-center bg-muted/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={branding.hero_image_url}
                        alt="Hero image"
                        className="max-h-48 max-w-full object-contain"
                      />
                    </div>
                  )}
                  <input
                    ref={heroRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onFileChange("hero")}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={uploading === "hero"}
                    onClick={() => heroRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading === "hero" ? "Uploading..." : "Upload Hero Image"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Cover Photo / Banner */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Cover Photo / Banner
                </CardTitle>
                <CardDescription>
                  Wide banner image used across pages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {branding.cover_photo_url && (
                    <div className="border rounded-lg p-4 flex items-center justify-center bg-muted/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={branding.cover_photo_url}
                        alt="Cover photo"
                        className="max-h-48 max-w-full object-contain"
                      />
                    </div>
                  )}
                  <input
                    ref={coverRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onFileChange("cover")}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={uploading === "cover"}
                    onClick={() => coverRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading === "cover" ? "Uploading..." : "Upload Cover Photo"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Colors Tab ── */}
        <TabsContent value="colors">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Brand Colors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="color"
                      value={branding.primary_color}
                      onChange={(e) =>
                        setBranding((p) => ({ ...p, primary_color: e.target.value }))
                      }
                      className="h-10 w-14 rounded border cursor-pointer"
                    />
                    <Input
                      value={branding.primary_color}
                      onChange={(e) =>
                        setBranding((p) => ({ ...p, primary_color: e.target.value }))
                      }
                      placeholder="#1E4DA1"
                      className="flex-1"
                    />
                  </div>
                  <div
                    className="h-8 rounded-md border"
                    style={{ backgroundColor: branding.primary_color }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="color"
                      value={branding.secondary_color}
                      onChange={(e) =>
                        setBranding((p) => ({
                          ...p,
                          secondary_color: e.target.value,
                        }))
                      }
                      className="h-10 w-14 rounded border cursor-pointer"
                    />
                    <Input
                      value={branding.secondary_color}
                      onChange={(e) =>
                        setBranding((p) => ({
                          ...p,
                          secondary_color: e.target.value,
                        }))
                      }
                      placeholder="#0F6E56"
                      className="flex-1"
                    />
                  </div>
                  <div
                    className="h-8 rounded-md border"
                    style={{ backgroundColor: branding.secondary_color }}
                  />
                </div>
              </div>

              {/* Contrast warnings */}
              {(() => {
                const primaryOk = meetsWCAGAA("#ffffff", branding.primary_color);
                const secondaryOk = meetsWCAGAA("#ffffff", branding.secondary_color);
                const primaryRatio = getContrastRatio("#ffffff", branding.primary_color).toFixed(1);
                const secondaryRatio = getContrastRatio("#ffffff", branding.secondary_color).toFixed(1);
                return (!primaryOk || !secondaryOk) ? (
                  <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 p-3 flex items-start gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">Low contrast warning (WCAG AA)</p>
                      <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
                        White text requires a contrast ratio of at least 4.5:1.
                        {!primaryOk && ` Primary (${primaryRatio}:1) fails.`}
                        {!secondaryOk && ` Secondary (${secondaryRatio}:1) fails.`}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 text-xs"
                        onClick={() => {
                          setBranding((p) => ({
                            ...p,
                            ...((!primaryOk) ? { primary_color: suggestAccessibleColor(p.primary_color) } : {}),
                            ...((!secondaryOk) ? { secondary_color: suggestAccessibleColor(p.secondary_color) } : {}),
                          }));
                        }}
                      >
                        Corriger le contraste
                      </Button>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Preview */}
              <div className="mt-6 border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Preview</h4>
                <div className="flex gap-3">
                  <div
                    className="rounded-lg px-4 py-2 text-white text-sm font-medium"
                    style={{ backgroundColor: branding.primary_color }}
                  >
                    Primary Button
                  </div>
                  <div
                    className="rounded-lg px-4 py-2 text-white text-sm font-medium"
                    style={{ backgroundColor: branding.secondary_color }}
                  >
                    Secondary Button
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Fonts Tab ── */}
        <TabsContent value="fonts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Type className="h-4 w-4" />
                Typography
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Heading Font</Label>
                  <select
                    value={branding.heading_font}
                    onChange={(e) =>
                      setBranding((p) => ({ ...p, heading_font: e.target.value }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <p
                    className="text-lg font-bold mt-2"
                    style={{ fontFamily: branding.heading_font }}
                  >
                    Heading Preview
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Body Font</Label>
                  <select
                    value={branding.body_font}
                    onChange={(e) =>
                      setBranding((p) => ({ ...p, body_font: e.target.value }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <p
                    className="text-sm mt-2"
                    style={{ fontFamily: branding.body_font }}
                  >
                    Body text preview — The quick brown fox jumps over the lazy dog.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
