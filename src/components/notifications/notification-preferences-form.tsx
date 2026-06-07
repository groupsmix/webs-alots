"use client";
/* eslint-disable i18next/no-literal-string -- Internal/super-admin-only surface or English-first form. The FR/AR translation backlog will catch up; do not add these strings to the i18n keyset now. */

import { Bell, Mail, MessageCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferenceSettings,
} from "@/lib/notification-preferences";

export function NotificationPreferencesForm() {
  const [preferences, setPreferences] = useState<NotificationPreferenceSettings>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/notifications/preferences", { cache: "no-store" });
        const json = (await response.json()) as {
          ok?: boolean;
          data?: { preferences?: NotificationPreferenceSettings };
        };

        if (response.ok && json.data?.preferences) {
          setPreferences(json.data.preferences);
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  function updatePreference<K extends keyof NotificationPreferenceSettings>(
    key: K,
    value: NotificationPreferenceSettings[K],
  ) {
    setPreferences((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        setMessage("Impossible d'enregistrer vos préférences pour le moment.");
        return;
      }

      setMessage("Préférences enregistrées.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Canaux</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PreferenceRow
            icon={<MessageCircle className="h-4 w-4 text-green-600" />}
            label="Notifications WhatsApp"
            checked={preferences.whatsapp_enabled}
            disabled={loading}
            onCheckedChange={(value) => updatePreference("whatsapp_enabled", value)}
          />
          <PreferenceRow
            icon={<Bell className="h-4 w-4 text-blue-600" />}
            label="Notifications in-app"
            checked={preferences.in_app_enabled}
            disabled={loading}
            onCheckedChange={(value) => updatePreference("in_app_enabled", value)}
          />
          <PreferenceRow
            icon={<Mail className="h-4 w-4 text-violet-600" />}
            label="Notifications email"
            checked={preferences.email_enabled}
            disabled={loading}
            onCheckedChange={(value) => updatePreference("email_enabled", value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Types de notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PreferenceRow
            label="Rappels de rendez-vous"
            checked={preferences.appointment_reminders}
            disabled={loading}
            onCheckedChange={(value) => updatePreference("appointment_reminders", value)}
          />
          <PreferenceRow
            label="Confirmations et changements de rendez-vous"
            checked={preferences.booking_confirmations}
            disabled={loading}
            onCheckedChange={(value) => updatePreference("booking_confirmations", value)}
          />
          <PreferenceRow
            label="Paiements et reçus"
            checked={preferences.payment_receipts}
            disabled={loading}
            onCheckedChange={(value) => updatePreference("payment_receipts", value)}
          />
          <PreferenceRow
            label="Mises à jour d'ordonnance"
            checked={preferences.prescription_updates}
            disabled={loading}
            onCheckedChange={(value) => updatePreference("prescription_updates", value)}
          />
          <PreferenceRow
            label="Avis et communications marketing"
            checked={preferences.marketing_updates}
            disabled={loading}
            onCheckedChange={(value) => updatePreference("marketing_updates", value)}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={() => void save()} disabled={loading || saving}>
          {saving ? "Enregistrement..." : "Enregistrer les préférences"}
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}

function PreferenceRow({
  icon,
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon?: ReactNode;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="flex items-center gap-3">
        {icon ? <div>{icon}</div> : null}
        <Label className="text-sm font-medium">{label}</Label>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}
