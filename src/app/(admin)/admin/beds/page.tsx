"use client";

import { useEffect, useState } from "react";
import { BedManagement } from "@/components/polyclinic/bed-management";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { useToast } from "@/components/ui/toast";
import { createClinicRoom } from "@/lib/admin-actions";
import { fetchBedManagementRooms, getCurrentUser } from "@/lib/data/client";
import { logger } from "@/lib/logger";

export default function AdminBedsPage() {
  const { addToast } = useToast();
  const [rooms, setRooms] = useState<Parameters<typeof BedManagement>[0]["rooms"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) {
        setLoading(false);
        return;
      }
      const data = await fetchBedManagementRooms(user.clinic_id);
      if (controller.signal.aborted) return;
      setRooms(data);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  async function reloadRooms() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    setRooms(await fetchBedManagementRooms(user.clinic_id));
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

  if (loading) return <PageLoader message="Loading bed management..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load bed management data.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Beds" }]} />
      <h1 className="text-2xl font-bold">Bed Management</h1>
      <BedManagement rooms={rooms} editable onAddRoom={handleAddRoom} />
    </div>
  );
}
