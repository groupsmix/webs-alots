"use client";

import { useState } from "react";
import { Moon, Sun, Clock, Calendar, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DEFAULT_RAMADAN_HOURS,
  type RamadanConfig,
} from "@/lib/morocco";

interface RamadanSettingsProps {
  config: RamadanConfig;
  onSave?: (config: RamadanConfig) => void;
}

const DAY_NAMES = [
  "Dimanche", "Lundi", "Mardi", "Mercredi",
  "Jeudi", "Vendredi", "Samedi",
];

/**
 * RamadanSettings
 *
 * Configure Ramadan mode for the clinic:
 * - Enable/disable Ramadan mode
 * - Set Ramadan date range
 * - Customize working hours during Ramadan
 * - Typically: 9:00-15:00, no lunch break, Saturday half-day
 */
export function RamadanSettings({ config, onSave }: RamadanSettingsProps) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [startDate, setStartDate] = useState(config.startDate);
  const [endDate, setEndDate] = useState(config.endDate);
  const [hours, setHours] = useState(config.workingHours);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave?.({
      enabled,
      startDate,
      endDate,
      workingHours: hours,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetToDefaults = () => {
    setHours(DEFAULT_RAMADAN_HOURS);
  };

  const updateDayHours = (
    day: number,
    field: "open" | "close" | "enabled",
    value: string | boolean
  ) => {
    setHours({
      ...hours,
      [day]: {
        ...hours[day],
        [field]: value,
      },
    });
  };

  const isActive = enabled && (() => {
    const today = new Date().toISOString().split("T")[0];
    return today >= startDate && today <= endDate;
  })();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Moon className="h-5 w-5 text-purple-600" />
            Mode Ramadan
            {/* Arabic: وضع رمضان */}
          </CardTitle>
          {isActive && (
            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              <Moon className="h-3 w-3 mr-1" />
              Actif
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable toggle */}
        <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
          <div className="flex items-center gap-3">
            <Moon className="h-5 w-5 text-purple-600" />
            <div>
              <p className="text-sm font-medium">Activer le mode Ramadan</p>
              <p className="text-xs text-muted-foreground">
                Ajuste automatiquement les horaires pendant le mois sacré
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-gray-300 h-5 w-5"
          />
        </label>

        {enabled && (
          <>
            {/* Date range */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Début du Ramadan
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Fin du Ramadan (Aïd al-Fitr)
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Working hours */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Horaires Ramadan
                </Label>
                <Button variant="ghost" size="sm" onClick={resetToDefaults} className="text-xs">
                  Réinitialiser
                </Button>
              </div>

              <div className="space-y-2">
                {DAY_NAMES.map((name, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-2 rounded-lg border ${
                      !hours[i]?.enabled ? "opacity-50 bg-muted/30" : ""
                    }`}
                  >
                    <label className="flex items-center gap-2 w-28 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hours[i]?.enabled ?? false}
                        onChange={(e) => updateDayHours(i, "enabled", e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{name}</span>
                    </label>
                    {hours[i]?.enabled && (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="time"
                          value={hours[i]?.open ?? "09:00"}
                          onChange={(e) => updateDayHours(i, "open", e.target.value)}
                          className="h-8 w-28"
                        />
                        <span className="text-sm text-muted-foreground">→</span>
                        <Input
                          type="time"
                          value={hours[i]?.close ?? "15:00"}
                          onChange={(e) => updateDayHours(i, "close", e.target.value)}
                          className="h-8 w-28"
                        />
                      </div>
                    )}
                    {!hours[i]?.enabled && (
                      <span className="text-xs text-muted-foreground">Fermé</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Info box */}
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 text-sm">
              <p className="font-medium text-purple-800 dark:text-purple-200 flex items-center gap-1">
                <Sun className="h-4 w-4" />
                Conseils pour le Ramadan
              </p>
              <ul className="mt-2 space-y-1 text-xs text-purple-700 dark:text-purple-300">
                <li>• Horaires réduits: 09h00 - 15h00 (sans pause déjeuner)</li>
                <li>• Samedi: demi-journée 09h00 - 13h00</li>
                <li>• Dimanche: fermé</li>
                <li>• Les rendez-vous existants hors des nouveaux horaires seront signalés</li>
              </ul>
            </div>

            <Button onClick={handleSave} className="w-full" size="sm">
              {saved ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Enregistré !
                </>
              ) : (
                "Enregistrer les paramètres Ramadan"
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
