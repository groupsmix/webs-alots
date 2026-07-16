"use client";

import { useState } from "react";
import { BedManagement } from "@/components/polyclinic/bed-management";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";
import { createClinicRoom } from "@/lib/admin-actions";
import { fetchBedManagementRooms, type BedManagementRoomView } from "@/lib/data/beds";
import { logger } from "@/lib/logger";

interface BedsClientProps {
  clinicId: string;
  initialRooms: BedManagementRoomView[];
}

export default function BedsClient({ clinicId, initialRooms }: BedsClientProps) {
  const { addToast } = useToast();
  const [rooms, setRooms] = useState<BedManagementRoomView[]>(initialRooms);

  async function reloadRooms() {
    const data = await fetchBedManagementRooms(clinicId);
    setRooms(data);
  }

  async function handleAddRoom(room: {
    roomNumber: string;
    roomType: string;
    floor: string;
    totalBeds: number;
  }) {
    try {
      await createClinicRoom(room);
      await reloadRooms();
      addToast("Room created", "success");
    } catch (err) {
      logger.warn("Failed to create room", { context: "admin/beds", error: err });
      addToast("Failed to create room", "error");
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Beds" }]} />
      <h1 className="text-2xl font-bold">Bed Management</h1>
      <BedManagement rooms={rooms} editable onAddRoom={handleAddRoom} />
    </div>
  );
}
