"use client";

import { useState } from "react";
import { ConsentFormManager } from "@/components/aesthetic/consent-form-manager";

export default function DoctorConsentFormsPage() {
  const [consents] = useState<Parameters<typeof ConsentFormManager>[0]["consents"]>([]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Photo Consent Forms</h1>
      <ConsentFormManager consents={consents} editable />
    </div>
  );
}
