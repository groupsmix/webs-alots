/* eslint-disable i18next/no-literal-string */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function AuditLogsPage() {
  const supabase = await createClient();

  // Just show recent events for now. The `activity_logs` table is the
  // application-level audit trail (see 00005_schema_gaps.sql).
  const { data } = await (
    // @ts-expect-error -- Supabase generated types lag behind actual DB schema
    supabase
      .from("activity_logs")
      .select("id, timestamp, action, actor, type, description, clinic_name")
      .order("timestamp", { ascending: false })
      .limit(50)
  );
  const logs = (data ?? null) as AuditLogEntry[] | null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Audit Logs</h1>
        <p className="text-muted-foreground">
          Monitor login failures, impersonation, and critical config changes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor / Clinic</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs && logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action}</Badge>
                      {log.type ? (
                        <Badge variant="secondary" className="ml-1">
                          {log.type}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{log.actor || "System"}</div>
                      <div className="text-xs text-muted-foreground">
                        {log.clinic_name || "Platform-wide"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-xs font-mono bg-muted/50 p-2 rounded">
                      {log.description ?? ""}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No audit logs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
