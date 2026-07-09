"use client";

import { useState } from "react";

export function EndImpersonationButton() {
  const [ending, setEnding] = useState(false);

  async function handleClick() {
    if (ending) return;
    setEnding(true);

    try {
      const response = await fetch("/api/impersonate", {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!response.ok) {
        setEnding(false);
        return;
      }

      window.location.href = "/super-admin/clinics";
    } catch {
      setEnding(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={ending}
      className="rounded border border-white/50 px-2 py-0.5 font-bold underline transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {ending ? "Fin..." : "Terminer la session"}
    </button>
  );
}
