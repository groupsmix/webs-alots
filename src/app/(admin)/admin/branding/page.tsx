"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Upload, Save, Image as ImageIcon, Type } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface BrandingState {
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  heading_font: string;
  body_font: string;
  hero_image_url: string | null;
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
  logo_url: null,
  favicon_url: null,
  primary_color: "#1E4DA1",
  secondary_color: "#0F6E56",
  heading_font: "Geist",
  body_font: "Geist",
  hero_image_url: null,
};

export default function BrandingPage() {
  const [branding, setBranding] = useState<BrandingState>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((data) => {
        setBranding({
          logo_url: data.logo_url ?? null,
          favicon_url: data.favicon_url ?? null,
          primary_color: data.primary_color ?? "#1E4DA1",
          secondary_color: data.secondary_color ?? "#0F6E56",
          heading_font: data.heading_font ?? "Geist",
          body_font: data.body_font ?? "Geist",
          hero_image_url: data.hero_image_url ?? null,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveColors = async () => {
    setSaving(true);
    try {
      await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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

  const handleUpload = async (field: "logo" | "favicon" | "hero", file: File) => {
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
      const urlField = field === "logo" ? "logo_url" : field === "favicon" ? "favicon_url" : "hero_image_url";
      setBranding((prev) => ({ ...prev, [urlField]: url }));
    } finally {
      setUploading(null);
    }
  };

  const onFileChange = (field: "logo" | "favicon" | "hero") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(field, file);
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Branding</h1>
        <p className="text-muted-foreground">Loading branding settings…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Branding</h1>

      <Tabs defaultValue="images">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="fonts">Fonts</TabsTrigger>
        </TabsList>

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
                    {uploading === "logo" ? "Uploading…" : "Upload Logo"}
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
                    {uploading === "favicon" ? "Uploading…" : "Upload Favicon"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Hero Image */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Hero Image
                </CardTitle>
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
                    {uploading === "hero" ? "Uploading…" : "Upload Hero Image"}
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Brand Colors
                </CardTitle>
                <Button
                  size="sm"
                  onClick={handleSaveColors}
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saved ? "Saved!" : saving ? "Saving…" : "Save"}
                </Button>
              </div>
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Typography
                </CardTitle>
                <Button
                  size="sm"
                  onClick={handleSaveColors}
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saved ? "Saved!" : saving ? "Saving…" : "Save"}
                </Button>
              </div>
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
