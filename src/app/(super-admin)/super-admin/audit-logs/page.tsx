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
  actor_id: string | null;
  ip_address: string | null;
  details: Record<string, unknown> | null;
}

export default async function AuditLogsPage() {
  const supabase = await createClient();

  // Just show recent events for now
  const { data: logs } = await supabase
    .from("audit_log")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(50);

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
                <TableHead>User / IP</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs && logs.length > 0 ? (
                logs.map((log: AuditLogEntry) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{log.actor_id || "System"}</div>
                      <div className="text-xs text-muted-foreground">
                        {log.ip_address || "Unknown IP"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-xs font-mono bg-muted/50 p-2 rounded">
                      {JSON.stringify(log.details)}
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
