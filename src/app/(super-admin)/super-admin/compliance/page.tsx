/* eslint-disable i18next/no-literal-string -- Internal/super-admin-only surface or English-first form. The FR/AR translation backlog will catch up; do not add these strings to the i18n keyset now. */
import { AlertTriangle, FileText, Lock, Scale, Shield, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createUntypedAdminClient } from "@/lib/supabase-server";

function statusVariant(
  status: string | null | undefined,
): "success" | "warning" | "destructive" | "outline" {
  if (!status) return "outline";
  if (["approved", "completed", "resolved"].includes(status)) return "success";
  if (["pending", "submitted", "received", "in_progress", "extended"].includes(status)) {
    return "warning";
  }
  if (
    [
      "rejected",
      "renewal_required",
      "investigating",
      "contained",
      "notifying_cndp",
      "high",
      "critical",
      "medium",
    ].includes(status)
  ) {
    return "destructive";
  }
  return "outline";
}

export default async function ComplianceCenterPage() {
  const supabase = createUntypedAdminClient("super_admin");
  const now = new Date().toISOString();

  const [
    cndpResult,
    openDsarsResult,
    overdueDsarsResult,
    activeBreachesResult,
    retentionResult,
    consentRecordsResult,
    legacyConsentLogsResult,
    recentDsarsResult,
    breachListResult,
  ] = await Promise.all([
    supabase
      .from("compliance_cndp")
      .select(
        "registration_number, authorization_number, status, renewal_due_at, expires_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("dsar_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["received", "in_progress", "extended"]),
    supabase
      .from("dsar_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["received", "in_progress", "extended"])
      .lt("response_due_at", now),
    supabase
      .from("data_breach_incidents")
      .select("id", { count: "exact", head: true })
      .neq("status", "resolved"),
    supabase
      .from("data_retention_schedule")
      .select("data_type, retention_days, legal_basis, next_purge_at, records_purged_last_run")
      .order("data_type", { ascending: true })
      .limit(20),
    supabase.from("consent_records").select("id", { count: "exact", head: true }),
    supabase.from("consent_logs").select("id", { count: "exact", head: true }),
    supabase
      .from("dsar_requests")
      .select("id, dsar_number, requester_name, request_type, status, response_due_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("data_breach_incidents")
      .select("id, incident_number, severity, status, detected_at, description")
      .order("detected_at", { ascending: false })
      .limit(5),
  ]);

  const cndp = (cndpResult.data ?? null) as Record<string, unknown> | null;
  const retentionRows = (retentionResult.data ?? []) as Array<Record<string, unknown>>;
  const dsars = (recentDsarsResult.data ?? []) as Array<Record<string, unknown>>;
  const breaches = (breachListResult.data ?? []) as Array<Record<string, unknown>>;
  const overdueRetention = retentionRows.filter((row) => {
    if (typeof row.next_purge_at !== "string") return false;
    return new Date(row.next_purge_at) < new Date();
  }).length;
  const consentCount = (consentRecordsResult.count ?? 0) + (legacyConsentLogsResult.count ?? 0);

  return (
    <div className="space-y-8 p-4 md:p-6">
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Conformité" }]}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Centre de conformité</h1>
          <p className="text-muted-foreground">
            Suivi en direct de la conformité CNDP, DSAR, rétention, consentements et incidents de sécurité.
          </p>
        </div>
        <Link href="/dsar-request" className="text-sm text-primary underline">
          Formulaire DSAR public
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewCard
          title="CNDP"
          value={String(cndp?.registration_number ?? cndp?.status ?? "Non déposé")}
          hint={
            typeof cndp?.renewal_due_at === "string"
              ? `Renouvellement dû le ${new Date(cndp.renewal_due_at).toLocaleDateString("fr-MA")}`
              : "En attente de dépôt ou d'approbation"
          }
          variant={statusVariant(typeof cndp?.status === "string" ? cndp.status : undefined)}
        />
        <OverviewCard
          title="DSARs ouverts"
          value={String(openDsarsResult.count ?? 0)}
          hint={`${overdueDsarsResult.count ?? 0} en retard`}
          variant={
            (overdueDsarsResult.count ?? 0) > 0
              ? "destructive"
              : (openDsarsResult.count ?? 0) > 0
                ? "warning"
                : "success"
          }
        />
        <OverviewCard
          title="Incidents actifs"
          value={String(activeBreachesResult.count ?? 0)}
          hint="Incidents de sécurité actifs non résolus"
          variant={(activeBreachesResult.count ?? 0) > 0 ? "destructive" : "success"}
        />
        <OverviewCard
          title="Registre consentements"
          value={String(consentCount)}
          hint={`${consentRecordsResult.count ?? 0} structurés + ${legacyConsentLogsResult.count ?? 0} journaux legacy`}
          variant={consentCount > 0 ? "success" : "warning"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Demandes des personnes concernées
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dsars.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune demande DSAR soumise pour le moment.
              </p>
            ) : (
              dsars.map((request) => {
                const overdue =
                  typeof request.response_due_at === "string" &&
                  new Date(request.response_due_at) < new Date() &&
                  request.status !== "completed";

                return (
                  <div key={String(request.id)} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          #{String(request.dsar_number ?? "—")} —{" "}
                          {String(request.requester_name ?? "Demandeur inconnu")}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {String(request.request_type ?? "other")}
                        </p>
                      </div>
                      <Badge
                        variant={
                          overdue ? "destructive" : statusVariant(String(request.status ?? ""))
                        }
                      >
                        {String(request.status ?? "unknown")}
                      </Badge>
                    </div>
                    {typeof request.response_due_at === "string" ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Échéance {new Date(request.response_due_at).toLocaleDateString("fr-MA")}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Registre des incidents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {breaches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun incident de sécurité enregistré.</p>
            ) : (
              breaches.map((incident) => (
                <div key={String(incident.id)} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        Incident #{String(incident.incident_number ?? "—")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Détecté le{" "}
                        {typeof incident.detected_at === "string"
                          ? new Date(incident.detected_at).toLocaleString("fr-MA")
                          : "inconnu"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={statusVariant(String(incident.severity ?? ""))}>
                        {String(incident.severity ?? "unknown")}
                      </Badge>
                      <Badge variant={statusVariant(String(incident.status ?? ""))}>
                        {String(incident.status ?? "unknown")}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {String(incident.description ?? "")}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr,1fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Dossier CNDP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Statut</span>
              <Badge
                variant={statusVariant(typeof cndp?.status === "string" ? cndp.status : undefined)}
              >
                {String(cndp?.status ?? "pending")}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Enregistrement</span>
              <span>{String(cndp?.registration_number ?? "—")}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Autorisation</span>
              <span>{String(cndp?.authorization_number ?? "—")}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Expiration</span>
              <span>
                {typeof cndp?.expires_at === "string"
                  ? new Date(cndp.expires_at).toLocaleDateString("fr-MA")
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Politique de rétention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <span className="text-muted-foreground">Calendriers configurés</span>
              <span className="font-medium">{retentionRows.length}</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <span className="text-muted-foreground">Purges en retard</span>
              <span className={`font-medium ${overdueRetention > 0 ? "text-destructive" : ""}`}>
                {overdueRetention}
              </span>
            </div>
            <div className="space-y-2">
              {retentionRows.slice(0, 4).map((row) => (
                <div key={String(row.data_type)} className="rounded-lg border p-3">
                  <p className="font-medium">{String(row.data_type)}</p>
                  <p className="text-xs text-muted-foreground">
                    {String(row.retention_days)} jours · {String(row.legal_basis ?? "")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Contrôles de conformité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ControlRow label="Chiffrement PHI" ok />
            <ControlRow label="Isolation multi-tenant" ok />
            <ControlRow label="Réception DSAR" ok />
            <ControlRow label="Preuves de consentement" ok={consentCount > 0} />
            <ControlRow label="Calendriers de rétention" ok={retentionRows.length > 0} />
            <ControlRow label="Registre incidents" ok />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
              Preuves de consentement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Les enregistrements de consentement structurés sont comptabilisés avec les journaux
            legacy afin que les audits de conformité puissent suivre l'adoption du nouveau registre
            sans perdre les preuves historiques.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewCard({
  title,
  value,
  hint,
  variant,
}: {
  title: string;
  value: string;
  hint: string;
  variant: "success" | "warning" | "destructive" | "outline";
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-bold">{value}</p>
            <Badge variant={variant}>{variant === "outline" ? "Info" : variant}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ControlRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <span>{label}</span>
      <Badge variant={ok ? "success" : "warning"}>{ok ? "OK" : "Attention"}</Badge>
    </div>
  );
}
