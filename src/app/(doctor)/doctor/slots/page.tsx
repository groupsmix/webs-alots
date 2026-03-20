"use client";

import { useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getNextAvailableSlots } from "@/lib/demo-data";

const doctorId = "d1";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function NextAvailableSlotsPage() {
  const [daysAhead, setDaysAhead] = useState(14);

  const availableSlots = getNextAvailableSlots(doctorId, daysAhead);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      day: dayNames[d.getDay()],
      date: d.getDate(),
      month: monthNames[d.getMonth()],
      full: dateStr,
    };
  };

  const totalSlots = availableSlots.reduce((sum, d) => sum + d.slots.length, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Next Available Slots
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDaysAhead(7)}
            className={daysAhead === 7 ? "bg-primary text-primary-foreground" : ""}
          >
            1 Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDaysAhead(14)}
            className={daysAhead === 14 ? "bg-primary text-primary-foreground" : ""}
          >
            2 Weeks
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDaysAhead(30)}
            className={daysAhead === 30 ? "bg-primary text-primary-foreground" : ""}
          >
            1 Month
          </Button>
        </div>
      </div>

      <div className="mb-6 flex gap-4">
        <Card className="flex-1">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{totalSlots}</p>
            <p className="text-xs text-muted-foreground">Total Available Slots</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{availableSlots.length}</p>
            <p className="text-xs text-muted-foreground">Days with Availability</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">
              {availableSlots.length > 0 ? availableSlots[0].slots[0] : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {availableSlots.length > 0 ? `Next: ${formatDate(availableSlots[0].date).day}, ${formatDate(availableSlots[0].date).month} ${formatDate(availableSlots[0].date).date}` : "No slots available"}
            </p>
          </CardContent>
        </Card>
      </div>

      {availableSlots.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No available slots in the next {daysAhead} days.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {availableSlots.map(({ date, slots }) => {
            const formatted = formatDate(date);
            return (
              <Card key={date}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      {formatted.day}, {formatted.month} {formatted.date}
                    </CardTitle>
                    <Badge variant="outline">{slots.length} slots</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <div
                        key={`${date}-${slot}`}
                        className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 px-3 py-1.5"
                      >
                        <Clock className="h-3 w-3 text-green-600" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                          {slot}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
