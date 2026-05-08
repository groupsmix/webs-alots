"use client";

import { useState } from "react";
import { ConsentFormManager } from "@/components/aesthetic/consent-form-manager";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function DoctorConsentFormsPage() {
  const [consents] = useState<Parameters<typeof ConsentFormManager>[0]["consents"]>([]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Consent Forms" }]} />
      <h1 className="text-2xl font-bold">Photo Consent Forms</h1>
      <ConsentFormManager consents={consents} editable />
    </div>
  );
}
