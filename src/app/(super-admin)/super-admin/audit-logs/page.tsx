/* eslint-disable i18next/no-literal-string */
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase-server";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string | null;
  type: string | null;
  description: string | null;
  clinic_name: string | null;
}

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{
    page?: string;
    event?: string;
    from?: string;
    to?: string;
  }>;
}

async function AuditTable({
  page,
  event,
  from,
  to,
}: {
  page: number;
  event?: string;
  from?: string;
  to?: string;
}) {
  const supabase = await createClient();
  const offset = (page - 1) * PAGE_SIZE;

  // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant audit view
  let query = supabase
    .from("activity_logs")
    .select("id, timestamp, action, actor, type, description, clinic_name", { count: "exact" })
    .order("timestamp", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (event) query = query.ilike("action", `%${event}%`);
  if (from) query = query.gte("timestamp", from);
  if (to) query = query.lte("timestamp", `${to}T23:59:59Z`);

  const { data, count } = await query;
  const logs = (data ?? []) as AuditLogEntry[];
  const total = count ?? 0;
  const hasNext = offset + PAGE_SIZE < total;
  const hasPrev = page > 1;

  const buildHref = (p: number) => {
    const sp = new URLSearchParams();
    sp.set("page", String(p));
    if (event) sp.set("event", event);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    return `?${sp.toString()}`;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">
            Activité récente
            <span className="ml-2 text-muted-foreground font-normal text-sm">
              ({total.toLocaleString()} entrées)
            </span>
          </CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/api/super-admin/audit-logs/export?${new URLSearchParams({
                ...(event ? { event } : {}),
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
              }).toString()}`}
            >
              Exporter CSV
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Horodatage</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Acteur / Clinique</TableHead>
                <TableHead>Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Aucun log trouvé.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs font-mono">
                      {new Date(log.timestamp).toLocaleString("fr-MA")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.action}
                      </Badge>
                      {log.type && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {log.type}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{log.actor ?? "Système"}</div>
                      <div className="text-xs text-muted-foreground">
                        {log.clinic_name ?? "Plateforme"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs font-mono bg-muted/40 p-1.5 rounded">
                      {log.description ?? ""}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-muted-foreground">
          Page {page} · {Math.min(offset + 1, total)}–{Math.min(offset + PAGE_SIZE, total)} sur{" "}
          {total.toLocaleString()}
        </span>
        <div className="flex gap-2">
          {hasPrev && (
            <Button asChild variant="outline" size="sm">
              <Link href={buildHref(page - 1)}>← Précédent</Link>
            </Button>
          )}
          {hasNext && (
            <Button asChild variant="outline" size="sm">
              <Link href={buildHref(page + 1)}>Suivant →</Link>
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

export default async function AuditLogsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const event = sp.event?.trim() || undefined;
  const from = sp.from?.trim() || undefined;
  const to = sp.to?.trim() || undefined;

  return (
    <div className="space-y-4 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Journal d&apos;audit</h1>
        <p className="text-muted-foreground">
          Connexions, impersonations, modifications critiques — loi 09-08.
        </p>
      </div>

      {/* Filter bar (native form — no JS required for submit) */}
      <form className="flex flex-wrap gap-3 items-end" method="GET">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="f-event">
            Action
          </label>
          <Input
            id="f-event"
            name="event"
            defaultValue={event ?? ""}
            placeholder="ex: login, cancelled…"
            className="h-8 w-44 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="f-from">
            Depuis
          </label>
          <Input
            id="f-from"
            name="from"
            type="date"
            defaultValue={from ?? ""}
            className="h-8 w-36 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="f-to">
            Jusqu&apos;au
          </label>
          <Input
            id="f-to"
            name="to"
            type="date"
            defaultValue={to ?? ""}
            className="h-8 w-36 text-sm"
          />
        </div>
        <Button type="submit" size="sm" className="h-8">
          Filtrer
        </Button>
        {(event || from || to) && (
          <Button asChild variant="ghost" size="sm" className="h-8">
            <Link href="/super-admin/audit-logs">Réinitialiser</Link>
          </Button>
        )}
      </form>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AuditTable page={page} event={event} from={from} to={to} />
      </Suspense>
    </div>
  );
}
