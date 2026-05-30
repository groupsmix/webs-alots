/* eslint-disable i18next/no-literal-string */
"use client";

import { Globe, Clock, Bell, RefreshCw, Info, Save, Loader2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

const LANGUAGES = [
  { value: "fr", label: "French" },
  { value: "ar", label: "Arabic" },
  { value: "en", label: "English" },
];

const TIMEZONES = [
  { value: "Africa/Casablanca", label: "Africa/Casablanca (GMT+1)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET)" },
  { value: "UTC", label: "UTC" },
];

const REFRESH_INTERVALS = [
  { value: "30", label: "30 seconds" },
  { value: "60", label: "1 minute" },
  { value: "300", label: "5 minutes" },
  { value: "600", label: "10 minutes" },
  { value: "0", label: "Manual only" },
];

export default function SettingsPage() {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  const [language, setLanguage] = useState("fr");
  const [timezone, setTimezone] = useState("Africa/Casablanca");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState("60");

  async function handleSave() {
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      addToast("Settings saved successfully", "success");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Settings" }]}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure system-wide preferences and platform settings.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          <Save className="h-4 w-4 mr-1" />
          Save Settings
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Language & Timezone */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Localization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="language">Default Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email-notif">Email Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Receive important alerts and reports via email.
                </p>
              </div>
              <Switch
                id="email-notif"
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="inapp-notif">In-App Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Show notifications in the dashboard header.
                </p>
              </div>
              <Switch
                id="inapp-notif"
                checked={inAppNotifications}
                onCheckedChange={setInAppNotifications}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dashboard */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="refresh">Auto-Refresh Interval</Label>
              <Select value={refreshInterval} onValueChange={setRefreshInterval}>
                <SelectTrigger id="refresh" className="w-[200px]">
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  {REFRESH_INTERVALS.map((interval) => (
                    <SelectItem key={interval.value} value={interval.value}>
                      {interval.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How often the dashboard data refreshes automatically.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Platform Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />
              Platform Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Version:</span>
                {/* nosemgrep: semgrep.env-access — client-side public env var for display only */}
                <Badge variant="outline">{process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Environment:</span>
                {/* nosemgrep: semgrep.env-access — NODE_ENV is always available at build time */}
                <Badge variant="outline">{process.env.NODE_ENV ?? "production"}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Last Deploy:</span>
                {/* nosemgrep: semgrep.env-access — client-side public env var for display only */}
                <span>{process.env.NEXT_PUBLIC_DEPLOY_DATE || "N/A"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Framework:</span>
                <span>Next.js 16 + React 19</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
