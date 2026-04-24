"use client";

import { Building2, Users, BedDouble, Calendar, TrendingUp, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DepartmentStats {
  id: string;
  name: string;
  doctorCount: number;
  patientCount: number;
  totalBeds: number;
  occupiedBeds: number;
  todayAppointments: number;
  admissionsThisMonth: number;
  dischargesThisMonth: number;
}

interface DepartmentDashboardProps {
  stats: DepartmentStats[];
}

export function DepartmentDashboard({ stats }: DepartmentDashboardProps) {
  const totalDoctors = stats.reduce((s, d) => s + d.doctorCount, 0);
  const totalPatients = stats.reduce((s, d) => s + d.patientCount, 0);
  const totalBeds = stats.reduce((s, d) => s + d.totalBeds, 0);
  const totalOccupied = stats.reduce((s, d) => s + d.occupiedBeds, 0);
  const totalAppts = stats.reduce((s, d) => s + d.todayAppointments, 0);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.length}</p>
              <p className="text-xs text-muted-foreground">Departments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalDoctors}</p>
              <p className="text-xs text-muted-foreground">Doctors</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalPatients}</p>
              <p className="text-xs text-muted-foreground">Patients</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
              <BedDouble className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalOccupied}/{totalBeds}</p>
              <p className="text-xs text-muted-foreground">Beds Occupied</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100">
              <Calendar className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalAppts}</p>
              <p className="text-xs text-muted-foreground">Today&apos;s Appts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Department Breakdown */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Department Breakdown
        </h3>
        {stats.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No department data available.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {stats.map((dept) => {
              const occupancy = dept.totalBeds > 0 ? Math.round((dept.occupiedBeds / dept.totalBeds) * 100) : 0;
              return (
                <Card key={dept.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">{dept.name}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{dept.doctorCount} doctors</span>
                        <span>{dept.patientCount} patients</span>
                        <span>{dept.todayAppointments} appts</span>
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${occupancy > 85 ? "bg-red-500" : occupancy > 60 ? "bg-yellow-500" : "bg-green-500"}`}
                              style={{ width: `${occupancy}%` }}
                            />
                          </div>
                          <span className="text-[10px] w-8">{occupancy}%</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          +{dept.admissionsThisMonth} / -{dept.dischargesThisMonth}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
