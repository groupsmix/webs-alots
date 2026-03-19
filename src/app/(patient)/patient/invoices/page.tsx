import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { invoices } from "@/lib/demo-data";

const statusVariant: Record<string, "success" | "warning" | "destructive"> = {
  paid: "success",
  pending: "warning",
  overdue: "destructive",
};

export default function PatientInvoicesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Invoices</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-3 pr-4">Invoice</th>
                  <th className="text-left font-medium py-3 pr-4">Date</th>
                  <th className="text-left font-medium py-3 pr-4">Amount</th>
                  <th className="text-left font-medium py-3 pr-4">Method</th>
                  <th className="text-left font-medium py-3 pr-4">Status</th>
                  <th className="text-right font-medium py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{inv.id.toUpperCase()}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{inv.date}</td>
                    <td className="py-3 pr-4">{inv.amount} {inv.currency}</td>
                    <td className="py-3 pr-4 capitalize text-muted-foreground">{inv.method}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={statusVariant[inv.status]}>{inv.status}</Badge>
                    </td>
                    <td className="py-3 text-right">
                      <Button variant="ghost" size="sm">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
