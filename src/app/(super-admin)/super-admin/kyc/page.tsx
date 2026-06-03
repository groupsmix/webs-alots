/* eslint-disable i18next/no-literal-string */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface KycEntry {
  id: string;
  ice_number: string | null;
  rc_number: string | null;
  review_status: string;
  created_at: string;
  clinics: { name: string; subdomain: string; phone: string } | null;
}

export default async function KycReviewPage() {
  const supabase = await createClient();
  // Cast through `unknown` to a narrow row type — Supabase's generated types
  // generate excessively deep instantiations (TS2589) on joined selects when
  // the inferred Result is then mapped over JSX. Pin the shape we render.
  const { data: kycs } = (await supabase
    .from("clinic_kyc")
    .select("id, ice_number, rc_number, review_status, created_at, clinics(name, subdomain, phone)")
    .order("created_at", { ascending: false })) as unknown as { data: KycEntry[] | null };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">KYC Review Queue</h1>
        <p className="text-muted-foreground">Review self-service clinic registrations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending & Reviewed Clinics</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead>
                <TableHead>ICE / RC</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kycs && kycs.length > 0 ? (
                kycs.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>
                      <div className="font-medium">{k.clinics?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {k.clinics?.phone} | {k.clinics?.subdomain}.oltigo.com
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">ICE: {k.ice_number || "N/A"}</div>
                      <div className="text-sm">RC: {k.rc_number || "N/A"}</div>
                    </TableCell>
                    <TableCell>{new Date(k.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          k.review_status === "approved"
                            ? "success"
                            : k.review_status === "rejected"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {k.review_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">
                        Review Docs
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No KYC submissions found.
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
