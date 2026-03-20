"use client";

import { useState } from "react";
import { BedManagement } from "@/components/polyclinic/bed-management";

export default function AdminBedsPage() {
  const [rooms] = useState<Parameters<typeof BedManagement>[0]["rooms"]>([]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bed Management</h1>
      <BedManagement rooms={rooms} editable />
    </div>
  );
}
