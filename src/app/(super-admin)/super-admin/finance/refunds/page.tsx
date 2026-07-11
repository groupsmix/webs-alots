import { Suspense } from "react";
import { RefundActionsCell } from "@/components/admin/refund-actions-cell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatCurrency } from "@/lib/utils";

interface RefundRow {
  id: string;
  payment_order_id: string;
  amount_mad: number;
  status: string;
  initiated_at: string;
  resolved_at: string | null;
  clinic: { name: string } | null;
}

async function RefundList() {
  const supabase = await createClient();

  // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant read
  const { data } = await supabase
    .from("refund_approvals")
    .select(
      "id, payment_order_id, amount_mad, status, initiated_at, resolved_at, clinic:clinics(name)",
    )
    .order("initiated_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as RefundRow[];
  const pending = rows.filter((r) => r.status === "pending_second").length;

  return (
    <>
      {pending > 0 && (
        <Card className="border-amber-400 bg-amber-50 dark:bg-amber-950/20 mb-4">
          <CardContent className="py-3 px-4">
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              ⏳ {pending} remboursement{pending > 1 ? "s" : ""} en attente de 2ème approbation
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>File d&apos;approbation des remboursements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinique</TableHead>
                <TableHead>Commande</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Initié le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucun remboursement trouvé.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.clinic?.name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.payment_order_id}</TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {formatCurrency(r.amount_mad)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "approved"
                            ? "success"
                            : r.status === "rejected"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {r.status === "pending_second"
                          ? "En attente 2ème"
                          : r.status === "approved"
                            ? "Approuvé"
                            : "Rejeté"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(r.initiated_at).toLocaleDateString("fr-MA")}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending_second" ? (
                        <RefundActionsCell refundId={r.id} />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {r.resolved_at
                            ? new Date(r.resolved_at).toLocaleDateString("fr-MA")
                            : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

export default function RefundsPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Remboursements</h1>
        <p className="text-muted-foreground">
          Double-contrôle pour les remboursements supérieurs à 5 000 MAD
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <RefundList />
      </Suspense>
    </div>
  );
}
