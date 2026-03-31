"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Calendar,
  Users,
  CreditCard,
  Clock,
  Printer,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getCurrentUser,
  fetchTodayAppointments,
  fetchInvoices,
} from "@/lib/data/client";
import { getLocalDateStr } from "@/lib/utils";

interface EndOfDayReportButtonProps {
  trigger?: React.ReactNode;
}

export function EndOfDayReportButton({ trigger }: EndOfDayReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<{
    totalAppointments: number;
    completed: number;
    noShows: number;
    cancelled: number;
    pending: number;
    totalRevenue: number;
    paidCount: number;
    pendingPayments: number;
    uniquePatients: number;
    firstVisits: number;
  } | null>(null);

  const generateReport = async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user?.clinic_id) {
        setLoading(false);
        return;
      }

      const today = getLocalDateStr();
      const [appts, invoices] = await Promise.all([
        fetchTodayAppointments(user.clinic_id),
        fetchInvoices(user.clinic_id),
      ]);

      const todayInvoices = invoices.filter((inv) => inv.date === today);

      setReport({
        totalAppointments: appts.length,
        completed: appts.filter((a) => a.status === "completed").length,
        noShows: appts.filter((a) => a.status === "no-show").length,
        cancelled: appts.filter((a) => a.status === "cancelled").length,
        pending: appts.filter((a) => a.status === "scheduled" || a.status === "confirmed").length,
        totalRevenue: todayInvoices.reduce((sum, inv) => sum + inv.amount, 0),
        paidCount: todayInvoices.filter((inv) => inv.status === "paid").length,
        pendingPayments: todayInvoices.filter((inv) => inv.status === "pending").length,
        uniquePatients: new Set(appts.map((a) => a.patientId)).size,
        firstVisits: appts.filter((a) => a.isFirstVisit).length,
      });
    } catch {
      // Report generation failed silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !report) {
      generateReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-1" />
            End of Day Report
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px]" onClose={() => setOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              End of Day Report
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </DialogHeader>

          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Generating report...
            </div>
          ) : report ? (
            <div className="space-y-4 py-2">
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-lg font-bold">{report.totalAppointments}</p>
                      <p className="text-[10px] text-muted-foreground">Total Appointments</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Users className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-lg font-bold">{report.uniquePatients}</p>
                      <p className="text-[10px] text-muted-foreground">Unique Patients</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="text-lg font-bold">{report.totalRevenue} MAD</p>
                      <p className="text-[10px] text-muted-foreground">Revenue</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Clock className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="text-lg font-bold">{report.firstVisits}</p>
                      <p className="text-[10px] text-muted-foreground">First Visits</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Status breakdown */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Appointment Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                      <span>Completed: {report.completed}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      <span>Pending: {report.pending}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      <span>No-shows: {report.noShows}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                      <span>Cancelled: {report.cancelled}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5" />
                    Payment Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-base font-bold text-green-600">{report.totalRevenue} MAD</p>
                      <p className="text-[10px] text-muted-foreground">Collected</p>
                    </div>
                    <div>
                      <p className="text-base font-bold">{report.paidCount}</p>
                      <p className="text-[10px] text-muted-foreground">Paid</p>
                    </div>
                    <div>
                      <p className="text-base font-bold text-orange-600">{report.pendingPayments}</p>
                      <p className="text-[10px] text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {report.noShows > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-950/20">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    {report.noShows} patient(s) did not show up today.
                  </p>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <a href="/receptionist/daily-report">
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-1" />
                Full Report
              </Button>
            </a>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
