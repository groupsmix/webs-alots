/* eslint-disable i18next/no-literal-string */
"use client";

import {
  Shield,
  CheckCircle,
  Circle,
  FileText,
  Lock,
  Users,
  Upload,
  ChevronDown,
  ChevronRight,
  Scale,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ---------- types ---------- */

interface ChecklistItem {
  label: string;
  checked: boolean;
}

interface ChecklistSection {
  title: string;
  icon: React.ElementType;
  items: ChecklistItem[];
}

/* ---------- mock data ---------- */

const complianceSections: ChecklistSection[] = [
  {
    title: "Data Protection (Law 09-08)",
    icon: Lock,
    items: [
      { label: "PHI encrypted at rest (AES-256-GCM)", checked: true },
      { label: "PHI encrypted in transit (TLS 1.3)", checked: true },
      { label: "Tenant isolation enforced (RLS + application-level)", checked: true },
      { label: "Audit logging enabled", checked: true },
      { label: "Access controls by role", checked: true },
      { label: "Data retention policy defined", checked: true },
      { label: "Annual compliance audit completed", checked: false },
      { label: "Staff training records", checked: false },
    ],
  },
];

const dpas = [
  { provider: "Supabase DPA", status: "Active" },
  { provider: "Cloudflare DPA", status: "Active" },
];

const securityMeasures = [
  { label: "Encryption", value: "AES-256-GCM", verified: true },
  { label: "Authentication", value: "Supabase Auth + RBAC", verified: true },
  { label: "CSRF Protection", value: "Enabled", verified: true },
  { label: "Rate Limiting", value: "Enabled", verified: true },
];

/* ---------- sub-components ---------- */

function ComplianceChecklist({ section }: { section: ChecklistSection }) {
  const [expanded, setExpanded] = useState(true);
  const completed = section.items.filter((i) => i.checked).length;
  const total = section.items.length;

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <section.icon className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">{section.title}</p>
            <p className="text-sm text-muted-foreground">
              {completed}/{total} completed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={completed === total ? "success" : "warning"}>
            {completed === total ? "Complete" : "In Progress"}
          </Badge>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t px-4 py-3 space-y-2">
          {section.items.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              {item.checked ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-yellow-500" />
              )}
              <span
                className={`text-sm ${item.checked ? "text-foreground" : "text-muted-foreground"}`}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- page ---------- */

export default function ComplianceCenterPage() {
  return (
    <div className="space-y-8 p-4 md:p-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Compliance" }]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance Center</h1>
          <p className="text-muted-foreground">
            Monitor regulatory compliance, data protection, and security status
          </p>
        </div>
      </div>

      {/* Compliance Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Moroccan Law 09-08</p>
              <Badge variant="success" className="text-sm font-bold">
                Compliant
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">GDPR Status</p>
              <Badge variant="success" className="text-sm font-bold">
                Compliant
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Last Audit Date</p>
              <p className="text-lg font-bold">2026-05-15</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Next Audit Due</p>
              <p className="text-lg font-bold">2026-08-15</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Compliance Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {complianceSections.map((section) => (
            <ComplianceChecklist key={section.title} section={section} />
          ))}
        </CardContent>
      </Card>

      {/* Patient Rights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Patient Rights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Data Access Requests</p>
              <p className="mt-1 text-2xl font-bold">0</p>
              <p className="text-xs text-muted-foreground">pending</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Data Deletion Requests</p>
              <p className="mt-1 text-2xl font-bold">0</p>
              <p className="text-xs text-muted-foreground">pending</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Consent Records</p>
              <Badge variant="success" className="mt-1">
                All patients consented
              </Badge>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" size="sm">
              Process Request
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Processing Agreements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Data Processing Agreements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dpas.map((dpa) => (
              <div
                key={dpa.provider}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{dpa.provider}</span>
                </div>
                <Badge variant="success">{dpa.status}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Upload DPA
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Measures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Measures
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {securityMeasures.map((measure) => (
              <div
                key={measure.label}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{measure.label}</p>
                  <p className="text-sm text-muted-foreground">{measure.value}</p>
                </div>
                {measure.verified ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">Verified</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-yellow-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">Pending</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
