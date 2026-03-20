"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Type, ImageIcon, Eye, Save, RotateCcw } from "lucide-react";
import {
  defaultWebsiteConfig,
  type WebsiteConfig,
} from "@/lib/website-config";

export default function WebsiteEditorPage() {
  const [config, setConfig] = useState<WebsiteConfig>(defaultWebsiteConfig);
  const [saved, setSaved] = useState(false);

  function updateHero(key: keyof WebsiteConfig["hero"], value: string) {
    setConfig((prev) => ({ ...prev, hero: { ...prev.hero, [key]: value } }));
    setSaved(false);
  }

  function updateAbout(key: keyof WebsiteConfig["about"], value: string) {
    setConfig((prev) => ({
      ...prev,
      about: { ...prev.about, [key]: value },
    }));
    setSaved(false);
  }

  function updateContact(key: keyof WebsiteConfig["contact"], value: string) {
    setConfig((prev) => ({
      ...prev,
      contact: { ...prev.contact, [key]: value },
    }));
    setSaved(false);
  }

  function updateLocation(
    key: keyof WebsiteConfig["location"],
    value: string
  ) {
    setConfig((prev) => ({
      ...prev,
      location: { ...prev.location, [key]: value },
    }));
    setSaved(false);
  }

  function updateTheme(key: keyof WebsiteConfig["theme"], value: string) {
    setConfig((prev) => ({
      ...prev,
      theme: { ...prev.theme, [key]: value },
    }));
    setSaved(false);
  }

  function updateServices(
    key: keyof WebsiteConfig["services"],
    value: string
  ) {
    setConfig((prev) => ({
      ...prev,
      services: { ...prev.services, [key]: value },
    }));
    setSaved(false);
  }

  function updateReviews(key: keyof WebsiteConfig["reviews"], value: string) {
    setConfig((prev) => ({
      ...prev,
      reviews: { ...prev.reviews, [key]: value },
    }));
    setSaved(false);
  }

  function handleSave() {
    setSaved(true);
  }

  function handleReset() {
    setConfig(defaultWebsiteConfig);
    setSaved(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Website Editor</h1>
          <p className="text-muted-foreground">
            Customize your public website content, colors, and images
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            {saved ? "Saved!" : "Save Changes"}
          </Button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1 text-sm font-medium hover:bg-muted"
          >
            <Eye className="h-4 w-4" />
            Preview
          </a>
        </div>
      </div>

      <Tabs defaultValue="content" className="space-y-6">
        <TabsList>
          <TabsTrigger value="content">
            <Type className="h-4 w-4 mr-2" />
            Content
          </TabsTrigger>
          <TabsTrigger value="images">
            <ImageIcon className="h-4 w-4 mr-2" />
            Images
          </TabsTrigger>
          <TabsTrigger value="theme">
            <Palette className="h-4 w-4 mr-2" />
            Theme
          </TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Hero Section</CardTitle>
              <CardDescription>
                The main banner on your homepage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={config.hero.title}
                  onChange={(e) => updateHero("title", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Subtitle</Label>
                <Textarea
                  value={config.hero.subtitle}
                  onChange={(e) => updateHero("subtitle", e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Primary Button Text</Label>
                  <Input
                    value={config.hero.ctaPrimary}
                    onChange={(e) => updateHero("ctaPrimary", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secondary Button Text</Label>
                  <Input
                    value={config.hero.ctaSecondary}
                    onChange={(e) =>
                      updateHero("ctaSecondary", e.target.value)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About Doctor</CardTitle>
              <CardDescription>
                Doctor profile and clinic info
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Doctor Name</Label>
                  <Input
                    value={config.about.doctorName}
                    onChange={(e) =>
                      updateAbout("doctorName", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Specialty</Label>
                  <Input
                    value={config.about.specialty}
                    onChange={(e) =>
                      updateAbout("specialty", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea
                  value={config.about.bio}
                  onChange={(e) => updateAbout("bio", e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Education</Label>
                  <Input
                    value={config.about.education}
                    onChange={(e) =>
                      updateAbout("education", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Specialization</Label>
                  <Input
                    value={config.about.specialization}
                    onChange={(e) =>
                      updateAbout("specialization", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Experience</Label>
                  <Input
                    value={config.about.experience}
                    onChange={(e) =>
                      updateAbout("experience", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Languages</Label>
                  <Input
                    value={config.about.languages}
                    onChange={(e) =>
                      updateAbout("languages", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Practice Description</Label>
                <Textarea
                  value={config.about.practiceDescription}
                  onChange={(e) =>
                    updateAbout("practiceDescription", e.target.value)
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Practice Details</Label>
                <Textarea
                  value={config.about.practiceDetails}
                  onChange={(e) =>
                    updateAbout("practiceDetails", e.target.value)
                  }
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Services Page</CardTitle>
              <CardDescription>
                Services page header text
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={config.services.title}
                  onChange={(e) =>
                    updateServices("title", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Subtitle</Label>
                <Textarea
                  value={config.services.subtitle}
                  onChange={(e) =>
                    updateServices("subtitle", e.target.value)
                  }
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                Phone, email, WhatsApp, and address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={config.contact.phone}
                    onChange={(e) =>
                      updateContact("phone", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp Number</Label>
                  <Input
                    value={config.contact.whatsapp}
                    onChange={(e) =>
                      updateContact("whatsapp", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={config.contact.email}
                    onChange={(e) =>
                      updateContact("email", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={config.contact.address}
                    onChange={(e) =>
                      updateContact("address", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>WhatsApp Default Message</Label>
                <Input
                  value={config.contact.whatsappMessage}
                  onChange={(e) =>
                    updateContact("whatsappMessage", e.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location and Hours</CardTitle>
              <CardDescription>
                Clinic address and Google Maps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={config.location.address}
                    onChange={(e) =>
                      updateLocation("address", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={config.location.city}
                    onChange={(e) =>
                      updateLocation("city", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Google Maps Embed URL</Label>
                <Input
                  value={config.location.googleMapsEmbedUrl}
                  onChange={(e) =>
                    updateLocation("googleMapsEmbedUrl", e.target.value)
                  }
                  placeholder="https://www.google.com/maps/embed?pb=..."
                />
                <p className="text-xs text-muted-foreground">
                  Go to Google Maps, click Share, then Embed a map, and
                  copy the src URL from the iframe code.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reviews Page</CardTitle>
              <CardDescription>
                Reviews page header text
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={config.reviews.title}
                  onChange={(e) =>
                    updateReviews("title", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Subtitle</Label>
                <Textarea
                  value={config.reviews.subtitle}
                  onChange={(e) =>
                    updateReviews("subtitle", e.target.value)
                  }
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Hero Image</CardTitle>
              <CardDescription>
                Main image displayed on the homepage hero section
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input
                  value={config.hero.imageUrl ?? ""}
                  onChange={(e) =>
                    updateHero("imageUrl", e.target.value)
                  }
                  placeholder="https://example.com/hero-image.jpg"
                />
              </div>
              {config.hero.imageUrl && (
                <div className="rounded-lg border overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={config.hero.imageUrl}
                    alt="Hero preview"
                    className="max-h-48 w-full object-cover"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Doctor Photo</CardTitle>
              <CardDescription>
                Photo displayed on the About page and homepage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Photo URL</Label>
                <Input
                  value={config.about.photoUrl ?? ""}
                  onChange={(e) =>
                    updateAbout("photoUrl", e.target.value)
                  }
                  placeholder="https://example.com/doctor-photo.jpg"
                />
              </div>
              {config.about.photoUrl && (
                <div className="rounded-lg border overflow-hidden w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={config.about.photoUrl}
                    alt="Doctor preview"
                    className="h-48 w-48 object-cover"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Theme Tab */}
        <TabsContent value="theme" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Color Theme</CardTitle>
              <CardDescription>
                Customize the primary and accent colors of your website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config.theme.primaryColor}
                      onChange={(e) =>
                        updateTheme("primaryColor", e.target.value)
                      }
                      className="h-10 w-10 cursor-pointer rounded border"
                    />
                    <Input
                      value={config.theme.primaryColor}
                      onChange={(e) =>
                        updateTheme("primaryColor", e.target.value)
                      }
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config.theme.accentColor}
                      onChange={(e) =>
                        updateTheme("accentColor", e.target.value)
                      }
                      className="h-10 w-10 cursor-pointer rounded border"
                    />
                    <Input
                      value={config.theme.accentColor}
                      onChange={(e) =>
                        updateTheme("accentColor", e.target.value)
                      }
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border p-6 mt-4">
                <p className="text-sm font-medium mb-3">Preview</p>
                <div className="flex items-center gap-4">
                  <div
                    className="h-16 w-16 rounded-lg shadow-sm"
                    style={{
                      backgroundColor: config.theme.primaryColor,
                    }}
                  />
                  <div
                    className="h-16 w-16 rounded-lg shadow-sm"
                    style={{
                      backgroundColor: config.theme.accentColor,
                    }}
                  />
                  <div className="flex-1">
                    <div
                      className="h-8 w-32 rounded flex items-center justify-center text-white text-xs font-medium"
                      style={{
                        backgroundColor: config.theme.primaryColor,
                      }}
                    >
                      Button Preview
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
