import type { Metadata } from "next";
import { DemoLoginCard } from "@/components/demo/demo-login-card";

export const metadata: Metadata = {
  title: "Démo — Oltigo",
  description:
    "Explorez la plateforme Oltigo en mode démo. Connectez-vous en un clic en tant que Docteur, Réceptionniste ou Patient.",
};

export default function DemoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50/70 via-white to-white">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <DemoLoginCard />
      </main>
    </div>
  );
}
