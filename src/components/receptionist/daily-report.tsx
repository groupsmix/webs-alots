"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Printer, FileText, Calendar, Users, CreditCard, Clock, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getCurrentUser,
  fetchTodayAppointments,
  fetchDoctors,
  fetchPatients,
  fetchInvoices,
  type AppointmentView,
  type DoctorView,
  type PatientView,
  type InvoiceView,
} from "@/lib/data/client";
import { exportAppointments, exportInvoices } from "@/lib/export-data";
import { PageLoader } from "@/components/ui/page-loader";

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  scheduled: "outline",
  confirmed: "default",
  "in-progress": "warning",
  completed: "success",
  "no-show": "destructive",
  cancelled: "secondary",
  rescheduled: "secondary",
};

export function DailyReport() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [todayAppointments, setTodayAppointments] = useState<AppointmentView[]>([]);
  const [doctorList, setDoctorList] = useState<DoctorView[]>([]);
  const [patientList, setPatientList] = useState<PatientView[]>([]);
  const [todayInvoices, setTodayInvoices] = useState<InvoiceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) { setLoading(false); return; }
      const today = new Date().toISOString().split("T")[0];
      const [appts, docs, pts, invs] = await Promise.all([
        fetchTodayAppointments(user.clinic_id),
        fetchDoctors(user.clinic_id),
        fetchPatients(user.clinic_id),
        fetchInvoices(user.clinic_id),
      ]);
      if (controller.signal.aborted) return;
      setTodayAppointments(appts);
      setDoctorList(docs);
      setPatientList(pts);
      setTodayInvoices(invs.filter((inv) => inv.date === today));
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, []);

  const completed = todayAppointments.filter((a) => a.status === "completed").length;
  const pending = todayAppointments.filter((a) => a.status === "scheduled" || a.status === "confirmed").length;
  const noShows = todayAppointments.filter((a) => a.status === "no-show").length;
  const cancelled = todayAppointments.filter((a) => a.status === "cancelled").length;

  const totalRevenue = todayInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidCount = todayInvoices.filter((inv) => inv.status === "paid").length;
  const pendingPayments = todayInvoices.filter((inv) => inv.status === "pending").length;

  const uniquePatients = new Set(todayAppointments.map((a) => a.patientId)).size;
  const firstVisits = todayAppointments.filter((a) => a.isFirstVisit).length;

  const handlePrint = useCallback(() => {
    const content = reportRef.current;
    if (!content) return;

    // Sanitize innerHTML: clone the DOM subtree and strip <script> tags plus
    // dangerous event-handler attributes (onclick, onerror, onload, etc.) to
    // prevent XSS if upstream components ever inject unescaped HTML.
    const clone = content.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("script").forEach((s) => s.remove());
    clone.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith("on")) {
          el.removeAttribute(attr.name);
        }
      }
    });
    const sanitizedHtml = clone.innerHTML;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Daily Report - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #111; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            h2 { font-size: 16px; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
            .date { color: #666; font-size: 14px; margin-bottom: 20px; }
            .stats { display: flex; gap: 20px; margin-bottom: 20px; }
            .stat { background: #f5f5f5; padding: 12px 16px; border-radius: 8px; flex: 1; }
            .stat-value { font-size: 24px; font-weight: 700; }
            .stat-label { font-size: 12px; color: #666; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eee; }
            th { background: #f9f9f9; font-weight: 600; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; }
            .badge-completed { background: #dcfce7; color: #166534; }
            .badge-scheduled { background: #e0f2fe; color: #0c4a6e; }
            .badge-confirmed { background: #dbeafe; color: #1e40af; }
            .badge-in-progress { background: #fef3c7; color: #92400e; }
            .badge-no-show { background: #fecaca; color: #991b1b; }
            .badge-cancelled { background: #f3f4f6; color: #374151; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${sanitizedHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, []);

  if (loading) {
    return <PageLoader message="Loading report..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Daily Report</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportAppointments(todayAppointments)}>
            <Download className="h-4 w-4 mr-1" />
            Export Appointments
          </Button>
          <Button variant="outline" onClick={() => exportInvoices(todayInvoices)}>
            <Download className="h-4 w-4 mr-1" />
            Export Invoices
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Print Report
          </Button>
        </div>
      </div>

      <div ref={reportRef}>
        <div className="print-header" style={{ display: "none" }}>
          <h1>Daily Patient Report</h1>
          <p className="date">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Calendar className="h-5 w-5 mx-auto mb-1 text-blue-600" />
              <p className="text-2xl font-bold">{todayAppointments.length}</p>
              <p className="text-xs text-muted-foreground">Total Appointments</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-green-600" />
              <p className="text-2xl font-bold">{uniquePatients}</p>
              <p className="text-xs text-muted-foreground">Unique Patients</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <CreditCard className="h-5 w-5 mx-auto mb-1 text-orange-600" />
              <p className="text-2xl font-bold">{totalRevenue} MAD</p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Clock className="h-5 w-5 mx-auto mb-1 text-purple-600" />
              <p className="text-2xl font-bold">{firstVisits}</p>
              <p className="text-xs text-muted-foreground">First Visits</p>
            </CardContent>
          </Card>
        </div>

        {/* Status Breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Status Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-sm">Completed: {completed}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
                <span className="text-sm">Pending: {pending}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-sm">No-shows: {noShows}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gray-400" />
                <span className="text-sm">Cancelled: {cancelled}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointments by Doctor */}
        {doctorList.map((doctor) => {
          const doctorAppts = todayAppointments.filter((a) => a.doctorId === doctor.id);
          if (doctorAppts.length === 0) return null;

          return (
            <Card key={doctor.id} className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{doctor.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{doctor.specialty} - {doctorAppts.length} appointments</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Time</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Patient</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Service</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Insurance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctorAppts
                        .sort((a, b) => a.time.localeCompare(b.time))
                        .map((apt) => {
                          const patient = patientList.find((p) => p.id === apt.patientId);
                          return (
                            <tr key={apt.id} className="border-b last:border-0">
                              <td className="py-2 px-3 font-medium">{apt.time}</td>
                              <td className="py-2 px-3">
                                <div>
                                  <span>{apt.patientName}</span>
                                  {apt.isFirstVisit && (
                                    <Badge variant="secondary" className="ml-2 text-[10px]">New</Badge>
                                  )}
                                </div>
                                {patient && (
                                  <span className="text-xs text-muted-foreground">{patient.phone}</span>
                                )}
                              </td>
                              <td className="py-2 px-3">{apt.serviceName}</td>
                              <td className="py-2 px-3">
                                <Badge variant={statusVariant[apt.status]}>{apt.status}</Badge>
                              </td>
                              <td className="py-2 px-3">
                                {apt.hasInsurance ? (
                                  <Badge variant="success" className="text-[10px]">Insured</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Payment Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-green-600">{totalRevenue} MAD</p>
                <p className="text-xs text-muted-foreground">Total Collected</p>
              </div>
              <div>
                <p className="text-lg font-bold">{paidCount}</p>
                <p className="text-xs text-muted-foreground">Payments Received</p>
              </div>
              <div>
                <p className="text-lg font-bold text-orange-600">{pendingPayments}</p>
                <p className="text-xs text-muted-foreground">Pending Payments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
