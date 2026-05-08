"use client";

import { Calendar, Plus, Clock, RotateCcw, User } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DialysisSessionStatus, DialysisRecurrencePattern } from "@/lib/types/database";

interface SessionView {
  id: string;
  patientName: string;
  doctorName: string | null;
  machineName: string | null;
  sessionDate: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  status: DialysisSessionStatus;
  isRecurring: boolean;
  recurrencePattern: DialysisRecurrencePattern | null;
  accessType: string | null;
}

const STATUS_CONFIG: Record<DialysisSessionStatus, { color: string; variant: "default" | "secondary" | "success" | "destructive" | "outline" | "warning" }> = {
  scheduled: { color: "text-blue-600", variant: "default" },
  in_progress: { color: "text-orange-600", variant: "warning" },
  completed: { color: "text-green-600", variant: "success" },
  cancelled: { color: "text-gray-500", variant: "secondary" },
  no_show: { color: "text-red-600", variant: "destructive" },
};

const RECURRENCE_LABELS: Record<DialysisRecurrencePattern, string> = {
  mon_wed_fri: "Mon/Wed/Fri",
  tue_thu_sat: "Tue/Thu/Sat",
  custom: "Custom",
};

interface SessionSchedulerProps {
  sessions: SessionView[];
  editable?: boolean;
  onAdd?: (session: { patientName: string; sessionDate: string; startTime: string; durationMinutes: number; isRecurring: boolean; recurrencePattern: DialysisRecurrencePattern | null }) => void;
  onUpdateStatus?: (sessionId: string, status: DialysisSessionStatus) => void;
}

export function SessionScheduler({ sessions, editable = false, onAdd, onUpdateStatus }: SessionSchedulerProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    patientName: "", sessionDate: "", startTime: "08:00",
    durationMinutes: "240", isRecurring: false, recurrencePattern: "" as string,
  });

  const handleAdd = () => {
    if (form.patientName.trim() && form.sessionDate && onAdd) {
      onAdd({
        patientName: form.patientName,
        sessionDate: form.sessionDate,
        startTime: form.startTime,
        durationMinutes: parseInt(form.durationMinutes) || 240,
        isRecurring: form.isRecurring,
        recurrencePattern: form.isRecurring && form.recurrencePattern ? form.recurrencePattern as DialysisRecurrencePattern : null,
      });
      setForm({ patientName: "", sessionDate: "", startTime: "08:00", durationMinutes: "240", isRecurring: false, recurrencePattern: "" });
      setShowForm(false);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const todaySessions = sessions.filter((s) => s.sessionDate === todayStr);
  const upcomingSessions = sessions.filter((s) => s.sessionDate > todayStr);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Dialysis Sessions
          <Badge variant="secondary" className="ml-1">{sessions.length}</Badge>
        </h2>
        {editable && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Schedule Session
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Schedule Dialysis Session</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Patient</Label>
                <Input value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} placeholder="Patient name" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" value={form.sessionDate} onChange={(e) => setForm({ ...form, sessionDate: e.target.value })} className="text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Start Time</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Duration (min)</Label>
                <Input type="number" min="60" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="text-sm" />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} className="rounded" />
                  <RotateCcw className="h-3 w-3" /> Recurring
                </label>
              </div>
            </div>
            {form.isRecurring && (
              <div>
                <Label className="text-xs">Recurrence Pattern</Label>
                <select value={form.recurrencePattern} onChange={(e) => setForm({ ...form, recurrencePattern: e.target.value })} className="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="">Select pattern</option>
                  <option value="mon_wed_fri">Mon / Wed / Fri</option>
                  <option value="tue_thu_sat">Tue / Thu / Sat</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>Schedule</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Sessions */}
      <div>
        <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> Today&apos;s Sessions ({todaySessions.length})
        </h3>
        {todaySessions.length === 0 ? (
          <Card><CardContent className="py-4 text-center text-sm text-muted-foreground">No sessions today.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {todaySessions.map((session) => (
              <SessionCard key={session.id} session={session} editable={editable} onUpdateStatus={onUpdateStatus} />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Upcoming ({upcomingSessions.length})</h3>
          <div className="space-y-2">
            {upcomingSessions.slice(0, 10).map((session) => (
              <SessionCard key={session.id} session={session} editable={editable} onUpdateStatus={onUpdateStatus} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, editable, onUpdateStatus }: { session: SessionView; editable: boolean; onUpdateStatus?: (id: string, status: DialysisSessionStatus) => void }) {
  const config = STATUS_CONFIG[session.status];
  return (
    <Card>
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className={`h-4 w-4 ${config.color}`} />
          <div>
            <p className="text-sm font-medium">{session.patientName}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{session.sessionDate} {session.startTime}</span>
              <span>{session.durationMinutes}min</span>
              {session.machineName && <span>Machine: {session.machineName}</span>}
              {session.accessType && <span>{session.accessType}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.isRecurring && session.recurrencePattern && (
            <Badge variant="outline" className="text-[10px]">
              <RotateCcw className="h-2.5 w-2.5 mr-0.5" /> {RECURRENCE_LABELS[session.recurrencePattern]}
            </Badge>
          )}
          <Badge variant={config.variant} className="text-xs">{session.status.replace("_", " ")}</Badge>
          {editable && session.status === "scheduled" && (
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onUpdateStatus?.(session.id, "in_progress")}>Start</Button>
          )}
          {editable && session.status === "in_progress" && (
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onUpdateStatus?.(session.id, "completed")}>Complete</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
