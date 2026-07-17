import { Eye, Package, Glasses, FileText, Calendar, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PRIMARY_ACTION_LABEL = "New prescription";

const stats = [
  { icon: Package, label: "Lens Types in Stock", value: "0", color: "text-blue-600" },
  { icon: Glasses, label: "Frame Models", value: "0", color: "text-green-600" },
  { icon: FileText, label: "Pending Prescriptions", value: "0", color: "text-orange-600" },
  { icon: Eye, label: "Delivered This Month", value: "0", color: "text-purple-600" },
];

export default function OpticianDashboardPage() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Optician Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Opticien — نظاراتي</p>
        </div>
        <Link href="/optician/prescriptions" className="shrink-0">
          <Button size="lg">
            <FileText className="h-4 w-4 me-2" />
            {PRIMARY_ACTION_LABEL}
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Today&apos;s Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No orders scheduled for today.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Inventory Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No low stock alerts.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
