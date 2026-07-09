/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import {
  Globe,
  Plus,
  Trash2,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CardSkeleton } from "@/components/ui/loading-skeleton";

interface CustomDomain {
  id: string;
  domain: string;
  status: "pending" | "active" | "failed" | "removing";
  ssl_status: string | null;
  verification_txt: string | null;
  created_at: string;
}

interface CustomDomainResponse {
  ok?: boolean;
  data?: {
    domains?: CustomDomain[];
  };
  error?: string;
}

async function readCustomDomainResponse(
  res: Response,
  fallbackMessage: string,
): Promise<CustomDomainResponse> {
  const json = (await res.json().catch(() => null)) as CustomDomainResponse | null;

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error ?? fallbackMessage);
  }

  return json;
}

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "text-yellow-600", badge: "warning" as const },
  active: { icon: CheckCircle, color: "text-green-600", badge: "default" as const },
  failed: { icon: AlertCircle, color: "text-red-600", badge: "destructive" as const },
  removing: { icon: Loader2, color: "text-gray-600", badge: "outline" as const },
};

export default function CustomDomainPage() {
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDomains = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/branding/custom-domain");
      const json = await readCustomDomainResponse(res, "Failed to load domains");
      setDomains(json.data?.domains ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load domains");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitialDomains = async () => {
      setError(null);
      try {
        const res = await fetch("/api/branding/custom-domain");
        const json = await readCustomDomainResponse(res, "Failed to load domains");
        if (!cancelled) {
          setDomains(json.data?.domains ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load domains");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadInitialDomains();

    return () => {
      cancelled = true;
    };
  }, []);

  const addDomain = async () => {
    if (!newDomain.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/branding/custom-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim().toLowerCase() }),
      });
      await readCustomDomainResponse(res, "Failed to add domain");
      setNewDomain("");
      await fetchDomains();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add domain");
    } finally {
      setAdding(false);
    }
  };

  const removeDomain = async (domainId: string) => {
    setDeleting(domainId);
    try {
      const res = await fetch("/api/branding/custom-domain", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      await readCustomDomainResponse(res, "Failed to remove domain");
      setDomains((prev) => prev.filter((d) => d.id !== domainId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove domain");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        items={[
          { label: "Admin" },
          { label: "Branding", href: "/admin/branding" },
          { label: "Custom Domain" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Custom Domain</h1>
          <p className="text-muted-foreground text-sm">
            Use your own domain for a fully white-labeled experience
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" /> Add Custom Domain
          </CardTitle>
          <CardDescription>
            Point your domain to our platform with automatic SSL provisioning via Cloudflare for
            SaaS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="clinic.yourdomain.com"
              className="max-w-md"
            />
            <Button onClick={addDomain} disabled={adding || !newDomain.trim()}>
              {adding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Domain
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-medium">Setup Instructions:</p>
            <ol className="mt-2 list-inside list-decimal space-y-1">
              <li>Add your domain below</li>
              <li>
                Create a CNAME record pointing your domain to <code>ssl.oltigo.com</code>
              </li>
              <li>If a TXT verification record is provided, add it to your DNS</li>
              <li>SSL will be provisioned automatically (may take up to 24 hours)</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <CardSkeleton />
      ) : domains.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground">No custom domains configured</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Domains</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {domains.map((domain) => {
                const config = STATUS_CONFIG[domain.status];
                const StatusIcon = config.icon;

                return (
                  <div
                    key={domain.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <StatusIcon className={`h-5 w-5 ${config.color}`} />
                      <div>
                        <p className="font-medium">{domain.domain}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>Added {new Date(domain.created_at).toLocaleDateString()}</span>
                          {domain.ssl_status && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Shield className="h-3 w-3" /> SSL: {domain.ssl_status}
                              </span>
                            </>
                          )}
                        </div>
                        {domain.verification_txt && domain.status === "pending" && (
                          <p className="mt-1 text-xs text-gray-500">
                            TXT Record:{" "}
                            <code className="rounded bg-gray-100 px-1">
                              {domain.verification_txt}
                            </code>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant={config.badge}>{domain.status}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => removeDomain(domain.id)}
                        disabled={deleting === domain.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
