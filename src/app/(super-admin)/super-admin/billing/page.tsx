import { CreditCard, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clinics } from "@/lib/demo-data";

const billingData = clinics.map((c) => ({
  ...c,
  lastPayment: "2026-03-01",
  nextDue: "2026-04-01",
  amountDue: c.plan === "premium" ? 500 : c.plan === "standard" ? 300 : 150,
  paid: c.status === "active",
}));

const totalMRR = billingData.reduce((sum, b) => sum + b.amountDue, 0);
const paidCount = billingData.filter((b) => b.paid).length;
const overdueCount = billingData.filter((b) => !b.paid).length;

export default function BillingManagementPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Billing Management</h1>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardContent className="p-4">
            <CreditCard className="h-5 w-5 text-green-600 mb-2" />
            <p className="text-2xl font-bold">{totalMRR.toLocaleString()} MAD</p>
            <p className="text-xs text-muted-foreground">Monthly Recurring Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <CreditCard className="h-5 w-5 text-blue-600 mb-2" />
            <p className="text-2xl font-bold">{paidCount}</p>
            <p className="text-xs text-muted-foreground">Paid This Month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <AlertCircle className="h-5 w-5 text-red-500 mb-2" />
            <p className="text-2xl font-bold">{overdueCount}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-3 pr-4">Clinic</th>
                  <th className="text-left font-medium py-3 pr-4">Plan</th>
                  <th className="text-left font-medium py-3 pr-4">Amount</th>
                  <th className="text-left font-medium py-3 pr-4">Last Payment</th>
                  <th className="text-left font-medium py-3 pr-4">Next Due</th>
                  <th className="text-left font-medium py-3 pr-4">Status</th>
                  <th className="text-right font-medium py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {billingData.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{b.name}</td>
                    <td className="py-3 pr-4 capitalize">{b.plan}</td>
                    <td className="py-3 pr-4">{b.amountDue} MAD</td>
                    <td className="py-3 pr-4 text-muted-foreground">{b.lastPayment}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{b.nextDue}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={b.paid ? "success" : "destructive"}>
                        {b.paid ? "Paid" : "Overdue"}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      <Button variant="outline" size="sm">
                        {b.paid ? "View Invoice" : "Send Reminder"}
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
