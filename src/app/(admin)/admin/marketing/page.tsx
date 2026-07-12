import { Bell, Star, Gift } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const sections = [
  {
    href: "/admin/notifications",
    title: "Notifications",
    description: "Envoyez des SMS, e-mails et messages WhatsApp.",
    icon: Bell,
  },
  {
    href: "/admin/reviews",
    title: "Avis patients",
    description: "Gérez les avis et la réputation de la clinique.",
    icon: Star,
  },
  {
    href: "/admin/referral-program",
    title: "Programme de parrainage",
    description: "Encouragez les patients à recommander votre cabinet.",
    icon: Gift,
  },
];

export default function AdminMarketingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketing</h1>
        <p className="text-muted-foreground">
          Communiquez avec vos patients et développez votre visibilité.
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
