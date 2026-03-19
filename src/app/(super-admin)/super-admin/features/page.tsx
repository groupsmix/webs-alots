import { ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const features = [
  { id: "f1", name: "Online Booking", description: "Allow patients to book appointments online", tiers: ["basic", "standard", "premium"], enabled: true },
  { id: "f2", name: "WhatsApp Notifications", description: "Send booking confirmations and reminders via WhatsApp", tiers: ["standard", "premium"], enabled: true },
  { id: "f3", name: "Patient Portal", description: "Give patients access to their medical records and invoices", tiers: ["standard", "premium"], enabled: true },
  { id: "f4", name: "Multi-doctor Support", description: "Support multiple doctors per clinic", tiers: ["premium"], enabled: true },
  { id: "f5", name: "Insurance Integration", description: "CNSS/CNOPS automatic claim processing", tiers: ["premium"], enabled: false },
  { id: "f6", name: "SMS Reminders", description: "Send appointment reminders via SMS", tiers: ["standard", "premium"], enabled: false },
  { id: "f7", name: "Custom Branding", description: "Allow clinics to customize their website theme and logo", tiers: ["premium"], enabled: true },
  { id: "f8", name: "API Access", description: "RESTful API access for third-party integrations", tiers: ["premium"], enabled: false },
  { id: "f9", name: "Revenue Reports", description: "Detailed revenue analytics and export", tiers: ["standard", "premium"], enabled: true },
  { id: "f10", name: "Walk-in Management", description: "Track and manage walk-in patients", tiers: ["basic", "standard", "premium"], enabled: true },
];

const tierColors: Record<string, "default" | "secondary" | "outline"> = {
  basic: "outline",
  standard: "secondary",
  premium: "default",
};

export default function FeatureTogglesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Feature Toggles</h1>

      <div className="space-y-3">
        {features.map((feature) => (
          <Card key={feature.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <Button variant="ghost" size="sm" className={feature.enabled ? "text-green-600" : "text-muted-foreground"}>
                {feature.enabled ? (
                  <ToggleRight className="h-6 w-6" />
                ) : (
                  <ToggleLeft className="h-6 w-6" />
                )}
              </Button>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{feature.name}</p>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
              <div className="flex items-center gap-1">
                {feature.tiers.map((tier) => (
                  <Badge key={tier} variant={tierColors[tier]} className="text-[10px] capitalize">
                    {tier}
                  </Badge>
                ))}
              </div>
              <Badge variant={feature.enabled ? "success" : "secondary"}>
                {feature.enabled ? "ON" : "OFF"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
