"use client";

import { useState } from "react";
import { BedManagement } from "@/components/polyclinic/bed-management";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function AdminBedsPage() {
  const [rooms] = useState<Parameters<typeof BedManagement>[0]["rooms"]>([]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Beds" }]} />
      <h1 className="text-2xl font-bold">Bed Management</h1>
      <BedManagement rooms={rooms} editable />
    </div>
  );
}
