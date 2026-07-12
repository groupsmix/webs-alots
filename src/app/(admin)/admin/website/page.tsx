import { Paintbrush, LayoutTemplate, ToggleRight, Palette } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const sections = [
  {
    href: "/admin/branding",
    title: "Branding",
    description: "Logo, couleurs, typographie et identité visuelle.",
    icon: Paintbrush,
  },
  {
    href: "/admin/templates",
    title: "Modèles de mise en page",
    description: "Sélectionnez un thème prédéfini pour votre site.",
    icon: LayoutTemplate,
  },
  {
    href: "/admin/sections",
    title: "Contrôle des sections",
    description: "Activez ou désactivez les blocs de votre site.",
    icon: ToggleRight,
  },
  {
    href: "/admin/website-editor",
    title: "Éditeur de site",
    description: "Personnalisez les pages et le contenu public.",
    icon: Palette,
  },
];

export default function AdminWebsitePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Site web</h1>
        <p className="text-muted-foreground">
          Gérez l&apos;identité, les templates et le contenu de votre site.
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
