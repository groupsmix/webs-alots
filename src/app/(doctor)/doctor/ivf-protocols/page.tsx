"use client";

import { useState, useEffect } from "react";
import { ProtocolTemplates } from "@/components/ivf/protocol-templates";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  fetchIVFProtocols,
  createIVFProtocol,
  type IVFProtocolView,
} from "@/lib/data/client";
import { logger } from "@/lib/logger";
import type { IVFProtocolType } from "@/lib/types/database";

export default function DoctorIVFProtocolsPage() {
  const { addToast } = useToast();
  const [protocols, setProtocols] = useState<IVFProtocolView[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) { setLoading(false); return; }
      setClinicId(user.clinic_id);
      const data = await fetchIVFProtocols(user.clinic_id);
      if (controller.signal.aborted) return;
      setProtocols(data);
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

  async function handleAdd(data: {
    name: string;
    protocolType: IVFProtocolType;
    description: string;
    durationDays: number;
  }) {
    if (!clinicId) return;
    try {
      const { id } = await createIVFProtocol(clinicId, data);
      setProtocols((prev) => [
        ...prev,
        {
          id,
          name: data.name,
          description: data.description || null,
          protocolType: data.protocolType,
          medications: [],
          steps: [],
          durationDays: data.durationDays || null,
        },
      ]);
      addToast("Protocol template created", "success");
    } catch (err) {
      logger.warn("Failed to create IVF protocol", { context: "doctor/ivf-protocols", error: err });
      addToast("Failed to create protocol. Please try again.", "error");
    }
  }

  if (loading) return <PageLoader message="Loading IVF protocols..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load IVF protocols.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "IVF Protocols" }]}
      />
      <h1 className="text-2xl font-bold">IVF Protocol Templates</h1>
      <ProtocolTemplates protocols={protocols} editable onAdd={handleAdd} />
    </div>
  );
}
