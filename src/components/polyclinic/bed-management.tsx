"use client";

import { BedDouble, Plus, User, AlertCircle, Wrench } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RoomView {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: string | null;
  departmentName: string | null;
  totalBeds: number;
  beds: BedView[];
}

interface BedView {
  id: string;
  bedNumber: string;
  status: "available" | "occupied" | "maintenance" | "reserved";
  patientName: string | null;
  admissionDate: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-800 border-green-200",
  occupied: "bg-red-100 text-red-800 border-red-200",
  maintenance: "bg-yellow-100 text-yellow-800 border-yellow-200",
  reserved: "bg-blue-100 text-blue-800 border-blue-200",
};

const STATUS_ICONS: Record<string, typeof BedDouble> = {
  available: BedDouble,
  occupied: User,
  maintenance: Wrench,
  reserved: AlertCircle,
};

interface BedManagementProps {
  rooms: RoomView[];
  editable?: boolean;
  onAdmit?: (bedId: string) => void;
  onDischarge?: (bedId: string) => void;
  onAddRoom?: (room: { roomNumber: string; roomType: string; floor: string; totalBeds: number }) => void;
}

export function BedManagement({ rooms, editable = false, onAdmit, onDischarge, onAddRoom }: BedManagementProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ roomNumber: "", roomType: "ward", floor: "", totalBeds: "1" });

  const totalBeds = rooms.reduce((sum, r) => sum + r.beds.length, 0);
  const occupiedBeds = rooms.reduce((sum, r) => sum + r.beds.filter((b) => b.status === "occupied").length, 0);
  const availableBeds = rooms.reduce((sum, r) => sum + r.beds.filter((b) => b.status === "available").length, 0);
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const handleAddRoom = () => {
    if (form.roomNumber.trim() && onAddRoom) {
      onAddRoom({ ...form, totalBeds: parseInt(form.totalBeds) || 1 });
      setForm({ roomNumber: "", roomType: "ward", floor: "", totalBeds: "1" });
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BedDouble className="h-5 w-5" />
          Bed Management
        </h2>
        {editable && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Room
          </Button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{totalBeds}</p>
            <p className="text-xs text-muted-foreground">Total Beds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{availableBeds}</p>
            <p className="text-xs text-muted-foreground">Available</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{occupiedBeds}</p>
            <p className="text-xs text-muted-foreground">Occupied</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{occupancyRate}%</p>
            <p className="text-xs text-muted-foreground">Occupancy Rate</p>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Add Room</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Room Number</Label>
                <Input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="101" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Room Type</Label>
                <select value={form.roomType} onChange={(e) => setForm({ ...form, roomType: e.target.value })} className="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="ward">Ward</option>
                  <option value="private">Private</option>
                  <option value="icu">ICU</option>
                  <option value="operating">Operating</option>
                  <option value="consultation">Consultation</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Floor</Label>
                <Input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="1st" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Total Beds</Label>
                <Input type="number" min="1" value={form.totalBeds} onChange={(e) => setForm({ ...form, totalBeds: e.target.value })} className="text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddRoom}>Create</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rooms & Beds */}
      {rooms.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <BedDouble className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No rooms configured.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <Card key={room.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    Room {room.roomNumber}
                    <Badge variant="outline" className="ml-2 text-[10px]">{room.roomType}</Badge>
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {room.departmentName && <span>{room.departmentName} &middot; </span>}
                    {room.floor && <span>Floor {room.floor}</span>}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                  {room.beds.map((bed) => {
                    const Icon = STATUS_ICONS[bed.status];
                    return (
                      <div key={bed.id} className={`rounded-lg border p-2 text-center ${STATUS_COLORS[bed.status]}`}>
                        <Icon className="h-4 w-4 mx-auto mb-1" />
                        <p className="text-xs font-medium">Bed {bed.bedNumber}</p>
                        <p className="text-[10px] capitalize">{bed.status}</p>
                        {bed.patientName && <p className="text-[10px] mt-1 truncate">{bed.patientName}</p>}
                        {editable && bed.status === "available" && (
                          <Button size="sm" variant="outline" className="text-[10px] h-5 mt-1 w-full" onClick={() => onAdmit?.(bed.id)}>
                            Admit
                          </Button>
                        )}
                        {editable && bed.status === "occupied" && (
                          <Button size="sm" variant="outline" className="text-[10px] h-5 mt-1 w-full" onClick={() => onDischarge?.(bed.id)}>
                            Discharge
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
