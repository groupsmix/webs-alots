/* eslint-disable i18next/no-literal-string -- Internal/super-admin-only surface or English-first form. The FR/AR translation backlog will catch up; do not add these strings to the i18n keyset now. */
import { Clock, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServiceClient } from "@/lib/supabase-server";

function formatDaysRemaining(dueAt: string) {
  const diff = new Date(dueAt).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export default async function ComplianceDsarPage() {
  const supabase = createServiceClient();
  const { data: requests } = await supabase
    .from("dsar_requests")
    .select(
      "id, dsar_number, requester_name, requester_email, request_type, status, response_due_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const overdue = (requests ?? []).filter(
    (request) => new Date(request.response_due_at) < new Date(),
  );

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Compliance", href: "/super-admin/compliance" },
          { label: "DSAR" },
        ]}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">DSAR Requests</h1>
          <p className="text-sm text-muted-foreground">
            Suivi des demandes d&apos;accès, rectification, suppression et portabilité.
          </p>
        </div>
        <Link href="/dsar-request" className="text-sm text-primary underline">
          Voir le formulaire public
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Demandes ouvertes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                (requests ?? []).filter(
                  (request) => request.status === "received" || request.status === "in_progress",
                ).length
              }
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">En retard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overdue.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Délai réglementaire</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">30 jours</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            File active
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">N°</th>
                  <th className="p-3">Demandeur</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Échéance</th>
                </tr>
              </thead>
              <tbody>
                {(requests ?? []).map((request) => {
                  const daysRemaining = formatDaysRemaining(request.response_due_at);
                  const isOverdue = daysRemaining < 0;
                  return (
                    <tr key={request.id} className="border-b">
                      <td className="p-3 font-medium">#{request.dsar_number}</td>
                      <td className="p-3">
                        <div>{request.requester_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {request.requester_email}
                        </div>
                      </td>
                      <td className="p-3 capitalize">{request.request_type}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            request.status === "completed"
                              ? "success"
                              : isOverdue
                                ? "destructive"
                                : "warning"
                          }
                        >
                          {request.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {new Date(request.response_due_at).toLocaleDateString("fr-MA")}
                          </span>
                        </div>
                        <div
                          className={`text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {isOverdue
                            ? `${Math.abs(daysRemaining)} jour(s) de retard`
                            : `${daysRemaining} jour(s) restants`}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
