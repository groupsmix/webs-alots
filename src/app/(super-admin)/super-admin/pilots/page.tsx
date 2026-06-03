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

interface PilotClinic {
  id: string;
  name: string;
  subdomain: string;
  type: string | null;
  auth_users: Array<{ count: number }> | null;
  appointments: Array<{ count: number }> | null;
}

export default async function PilotsDashboardPage() {
  const supabase = await createClient();

  // Fetch clinics that have 'pilot' in their notes or we can just fetch all and filter later.
  // For now, we simulate fetching the 3 designated pilot clinics.
  // @ts-expect-error -- Supabase generated types lag behind actual DB schema
  const { data } = await supabase
    .from("clinics")
    .select("*, auth_users:users(count), appointments(count)")
    .limit(10); // Adjust this query based on how pilots are tagged in production
  const pilots = (data ?? null) as PilotClinic[] | null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pilot Clinics Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor real-world usage and onboarding progress of pilot clinics.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Pilots</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Staff Count</TableHead>
                <TableHead>Total Appointments</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pilots && pilots.length > 0 ? (
                pilots.map((p: PilotClinic) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.name}
                      <div className="text-xs text-muted-foreground">{p.subdomain}.oltigo.com</div>
                    </TableCell>
                    <TableCell className="capitalize">{p.type || "General"}</TableCell>
                    <TableCell>{p.auth_users?.[0]?.count || 0}</TableCell>
                    <TableCell>{p.appointments?.[0]?.count || 0}</TableCell>
                    <TableCell>
                      <Badge variant="success">Onboarded</Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No pilot clinics found.
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
