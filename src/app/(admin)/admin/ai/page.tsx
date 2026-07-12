import { Brain, Cpu, Route } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const sections = [
  {
    href: "/admin/ai-manager",
    title: "AI Manager",
    description: "Activez les assistants IA et gérez leurs permissions.",
    icon: Brain,
  },
  {
    href: "/admin/ai-config",
    title: "Modèles IA",
    description: "Configurez les fournisseurs et les budgets.",
    icon: Cpu,
  },
  {
    href: "/admin/ai-routing",
    title: "Routage IA",
    description: "Définissez comment les conversations sont acheminées.",
    icon: Route,
  },
];

export default function AdminAiPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">IA</h1>
        <p className="text-muted-foreground">
          Outils IA internes : site builder, support triage et FAQ non diagnostique.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full hover:bg-accent/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <section.icon className="h-5 w-5" />
                  {section.title}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
