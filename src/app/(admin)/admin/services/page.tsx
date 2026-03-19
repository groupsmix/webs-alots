import { Plus, Edit, Trash2, Clock, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { services } from "@/lib/demo-data";

export default function ManageServicesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Services</h1>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          Add Service
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <Card key={service.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium">{service.name}</h3>
                <Badge variant={service.active ? "success" : "secondary"}>
                  {service.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {service.duration} min
                </span>
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  {service.price} {service.currency}
                </span>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
