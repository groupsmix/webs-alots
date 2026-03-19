import { Plus, LogIn, Search, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clinics } from "@/lib/demo-data";

export default function AllClinicsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">All Clinics</h1>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          New Client Setup
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search clinics by name, city, or type..." className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-3 px-4">Clinic</th>
                  <th className="text-left font-medium py-3 px-4">Type</th>
                  <th className="text-left font-medium py-3 px-4">City</th>
                  <th className="text-left font-medium py-3 px-4">Patients</th>
                  <th className="text-left font-medium py-3 px-4">Revenue</th>
                  <th className="text-left font-medium py-3 px-4">Plan</th>
                  <th className="text-left font-medium py-3 px-4">Status</th>
                  <th className="text-right font-medium py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clinics.map((clinic) => (
                  <tr key={clinic.id} className="border-b last:border-0">
                    <td className="py-3 px-4 font-medium">{clinic.name}</td>
                    <td className="py-3 px-4 capitalize text-muted-foreground">{clinic.type}</td>
                    <td className="py-3 px-4 text-muted-foreground">{clinic.city}</td>
                    <td className="py-3 px-4">{clinic.patientsCount}</td>
                    <td className="py-3 px-4">{clinic.monthlyRevenue.toLocaleString()} MAD</td>
                    <td className="py-3 px-4">
                      <Badge variant={clinic.plan === "premium" ? "default" : clinic.plan === "standard" ? "secondary" : "outline"}>
                        {clinic.plan}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={clinic.status === "active" ? "success" : clinic.status === "suspended" ? "destructive" : "secondary"}>
                        {clinic.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" title="Login as client">
                          <LogIn className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Suspend" className="text-red-500">
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
