"use client";

import { Gift, Copy, Download, Check, Clock, Users, DollarSign, Settings } from "lucide-react";
import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

// ── Types ──

type ReferralStatus = "pending" | "converted" | "expired";

interface Referral {
  id: string;
  referringClinic: string;
  referredClinic: string;
  status: ReferralStatus;
  reward: number;
  date: string;
}

interface ReferralSettings {
  rewardAmount: number;
  expiryDays: number;
  enabled: boolean;
}

// ── Mock data ──

const MOCK_REFERRALS: Referral[] = [
  {
    id: "ref-001",
    referringClinic: "Cabinet Dr. Bennani",
    referredClinic: "Clinique Al Amal",
    status: "converted",
    reward: 500,
    date: "2025-05-15",
  },
  {
    id: "ref-002",
    referringClinic: "Centre Dentaire Fès",
    referredClinic: "Pharmacie El Mokhtar",
    status: "pending",
    reward: 500,
    date: "2025-05-20",
  },
  {
    id: "ref-003",
    referringClinic: "Polyclinique Marrakech",
    referredClinic: "Cabinet Dr. Tazi",
    status: "converted",
    reward: 500,
    date: "2025-04-28",
  },
  {
    id: "ref-004",
    referringClinic: "Cabinet Dr. El Fassi",
    referredClinic: "Clinique Chifa",
    status: "expired",
    reward: 0,
    date: "2025-03-10",
  },
  {
    id: "ref-005",
    referringClinic: "Clinique Al Amal",
    referredClinic: "Centre Médical Rabat",
    status: "converted",
    reward: 500,
    date: "2025-05-02",
  },
  {
    id: "ref-006",
    referringClinic: "Cabinet Dr. Bennani",
    referredClinic: "Pharmacie Avicenne",
    status: "pending",
    reward: 500,
    date: "2025-05-25",
  },
  {
    id: "ref-007",
    referringClinic: "Polyclinique Marrakech",
    referredClinic: "Cabinet Dr. Ouazzani",
    status: "converted",
    reward: 500,
    date: "2025-04-15",
  },
  {
    id: "ref-008",
    referringClinic: "Centre Dentaire Fès",
    referredClinic: "Clinique Nour",
    status: "pending",
    reward: 500,
    date: "2025-05-28",
  },
];

const STATUS_LABELS: Record<ReferralStatus, string> = {
  pending: "En attente",
  converted: "Converti",
  expired: "Expiré",
};

const STATUS_COLORS: Record<ReferralStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  converted: "bg-green-100 text-green-800",
  expired: "bg-gray-100 text-gray-600",
};

// ── Helpers ──

function loadSettings(): ReferralSettings {
  if (typeof window === "undefined") {
    return { rewardAmount: 500, expiryDays: 30, enabled: true };
  }
  try {
    const raw = localStorage.getItem("oltigo_referral_settings");
    if (raw) return JSON.parse(raw) as ReferralSettings;
  } catch {
    // ignore parse errors
  }
  return { rewardAmount: 500, expiryDays: 30, enabled: true };
}

function saveSettings(settings: ReferralSettings) {
  localStorage.setItem("oltigo_referral_settings", JSON.stringify(settings));
}

function generateReferralCode(clinicName: string): string {
  const slug = clinicName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REF-${slug}-${suffix}`;
}

function exportToCsv(referrals: Referral[]) {
  const header = "Referring Clinic,Referred Clinic,Status,Reward (MAD),Date";
  const rows = referrals.map(
    (r) => `"${r.referringClinic}","${r.referredClinic}",${r.status},${r.reward},${r.date}`,
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "referrals-export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ──

type StatusFilter = "all" | ReferralStatus;

export default function ReferralsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [settings, setSettings] = useState<ReferralSettings>(loadSettings);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [selectedClinic, setSelectedClinic] = useState("");

  const referrals = MOCK_REFERRALS;
  const totalReferrals = referrals.length;
  const converted = referrals.filter((r) => r.status === "converted").length;
  const pending = referrals.filter((r) => r.status === "pending").length;
  const revenueFromReferrals = converted * settings.rewardAmount;

  const filtered =
    statusFilter === "all" ? referrals : referrals.filter((r) => r.status === statusFilter);

  const updateSettings = useCallback((patch: Partial<ReferralSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  const handleGenerateCode = useCallback(() => {
    if (!selectedClinic) return;
    setGeneratedCode(generateReferralCode(selectedClinic));
  }, [selectedClinic]);

  const uniqueClinics = Array.from(new Set(referrals.map((r) => r.referringClinic)));

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Referrals" }]}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Programme de parrainage</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suivez les parrainages, générez des codes et gérez les récompenses
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Referrals
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferrals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Converted</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{converted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue from Referrals
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revenueFromReferrals.toLocaleString()} MAD</div>
          </CardContent>
        </Card>
      </div>

      {/* Referral Code Generator */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Generate Referral Link / Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 w-full">
              <Label className="text-sm mb-1.5 block">Select Clinic</Label>
              <Select value={selectedClinic} onValueChange={setSelectedClinic}>
                <SelectTrigger>
                  <SelectValue
                    placeholder="Choose a clinic..."
                    value={selectedClinic || undefined}
                  />
                </SelectTrigger>
                <SelectContent>
                  {uniqueClinics.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateCode} disabled={!selectedClinic}>
              Generate Code
            </Button>
          </div>
          {generatedCode && (
            <div className="mt-3 flex items-center gap-2 bg-muted p-3 rounded-md">
              <code className="text-sm font-mono flex-1">{generatedCode}</code>
              <Button variant="outline" size="sm" onClick={() => handleCopyCode(generatedCode)}>
                {copiedCode === generatedCode ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Reward rules: Referring clinic gets {settings.rewardAmount} MAD credit, referred clinic
            gets 10% first month discount.
          </p>
        </CardContent>
      </Card>

      {/* Filter & Export Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "converted", "expired"] as const).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status === "all" ? "All" : STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => exportToCsv(filtered)}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Referral Table */}
      <Card className="mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Referring Clinic</th>
                <th className="text-left p-3 font-medium">Referred Clinic</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Reward (MAD)</th>
                <th className="text-left p-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ref) => (
                <tr key={ref.id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="p-3">{ref.referringClinic}</td>
                  <td className="p-3">{ref.referredClinic}</td>
                  <td className="p-3">
                    <Badge className={STATUS_COLORS[ref.status]}>{STATUS_LABELS[ref.status]}</Badge>
                  </td>
                  <td className="p-3 text-right font-medium">
                    {ref.reward > 0 ? `${ref.reward}` : "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">{ref.date}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No referrals match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Referral Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Referral Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Enable Referral Program</Label>
              <p className="text-xs text-muted-foreground">Toggle the referral program on or off</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => updateSettings({ enabled: checked })}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm mb-1.5 block">Reward Amount (MAD)</Label>
              <Input
                type="number"
                min={0}
                value={settings.rewardAmount}
                onChange={(e) =>
                  updateSettings({ rewardAmount: parseInt(e.target.value, 10) || 0 })
                }
              />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Referral Expiry</Label>
              <Select
                value={String(settings.expiryDays)}
                onValueChange={(v) => updateSettings({ expiryDays: parseInt(v, 10) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select expiry" value={`${settings.expiryDays} days`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Settings are saved locally (Phase 1). They will persist across browser sessions via
            localStorage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
