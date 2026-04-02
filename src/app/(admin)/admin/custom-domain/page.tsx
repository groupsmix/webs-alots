"use client";

import { Globe, CheckCircle2, AlertCircle, Clock, Copy, ExternalLink } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logger } from "@/lib/logger";

interface DomainSettings {
  custom_domain: string | null;
  dns_status: "pending" | "verified" | "failed" | null;
  subdomain: string | null;
  cname_target: string | null;
}

export default function CustomDomainPage() {
  const [settings, setSettings] = useState<DomainSettings>({
    custom_domain: null,
    dns_status: null,
    subdomain: null,
    cname_target: null,
  });
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/domain");
      if (res.ok) {
        const data = (await res.json()) as { settings: DomainSettings };
        setSettings(data.settings ?? settings);
        if (data.settings?.custom_domain) {
          setDomain(data.settings.custom_domain);
        }
      }
    } catch (err) {
      logger.warn("Failed to load domain settings", { context: "custom-domain-page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSaveDomain = async () => {
    if (!domain.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom_domain: domain.trim() }),
      });
      if (res.ok) {
        const data = (await res.json()) as { settings: DomainSettings };
        setSettings(data.settings ?? { ...settings, custom_domain: domain.trim(), dns_status: "pending" });
      }
    } catch (err) {
      logger.warn("Failed to save domain", { context: "custom-domain-page", error: err });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/settings/domain?action=verify");
      if (res.ok) {
        const data = (await res.json()) as { settings: DomainSettings };
        setSettings(data.settings ?? settings);
      }
    } catch (err) {
      logger.warn("Failed to verify domain", { context: "custom-domain-page", error: err });
    } finally {
      setVerifying(false);
    }
  };

  const handleCopyCname = () => {
    const target = settings.cname_target ?? "cname.oltigo.com";
    navigator.clipboard.writeText(target).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard API not available
    });
  };

  const dnsStatusColor = {
    pending: "text-yellow-600",
    verified: "text-green-600",
    failed: "text-red-600",
  };

  const dnsStatusIcon = {
    pending: <Clock className="h-4 w-4 text-yellow-600" />,
    verified: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    failed: <AlertCircle className="h-4 w-4 text-red-600" />,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Custom Domain" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" />
            Custom Domain
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your own domain to your clinic&apos;s public pages
          </p>
        </div>
      </div>

      <div className="space-y-4 max-w-2xl">
        {/* Current Status */}
        {settings.custom_domain && settings.dns_status && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {dnsStatusIcon[settings.dns_status]}
                Domain Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{settings.custom_domain}</p>
                  <p className={`text-xs capitalize ${dnsStatusColor[settings.dns_status]}`}>
                    {settings.dns_status === "pending" && "DNS verification pending..."}
                    {settings.dns_status === "verified" && "Domain verified and active"}
                    {settings.dns_status === "failed" && "DNS verification failed — check your records"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleVerify} disabled={verifying}>
                  {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                  Verify DNS
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enter Domain */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custom Domain</CardTitle>
            <CardDescription>Enter the domain you want to use for your clinic pages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Domain Name</Label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g., clinic.yourdomain.com"
              />
              <p className="text-xs text-muted-foreground">
                Enter your full domain or subdomain (e.g., clinic.yourdomain.com)
              </p>
            </div>
            <Button onClick={handleSaveDomain} disabled={saving || !domain.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Globe className="h-4 w-4 mr-1" />}
              {settings.custom_domain ? "Update Domain" : "Set Domain"}
            </Button>
          </CardContent>
        </Card>

        {/* DNS Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">DNS Configuration</CardTitle>
            <CardDescription>Add this CNAME record at your DNS provider</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/50 p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground">
                <span>Type</span>
                <span>Name</span>
                <span>Target</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Badge variant="secondary">CNAME</Badge>
                <span className="font-mono text-xs">{domain || "your-subdomain"}</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs">{settings.cname_target ?? "cname.oltigo.com"}</span>
                  <button onClick={handleCopyCname} className="text-muted-foreground hover:text-foreground">
                    {copied ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Instructions:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Log in to your DNS provider (e.g., Cloudflare, GoDaddy, Namecheap)</li>
                <li>Add a new CNAME record with the values above</li>
                <li>Wait for DNS propagation (can take up to 48 hours, usually minutes)</li>
                <li>Click &ldquo;Verify DNS&rdquo; above to check if the record is active</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Subdomain Info */}
        {settings.subdomain && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Default Subdomain</p>
                  <p className="text-xs text-muted-foreground">Your clinic is also accessible at:</p>
                </div>
                <a
                  href={`https://${settings.subdomain}.oltigo.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {settings.subdomain}.oltigo.com
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
