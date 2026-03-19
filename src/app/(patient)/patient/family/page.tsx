import { UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const familyMembers = [
  { id: "f1", name: "Laila Mansouri", relation: "Wife", age: 33, phone: "+212 6 11 22 33 55" },
  { id: "f2", name: "Yassine Mansouri", relation: "Son", age: 8, phone: "—" },
  { id: "f3", name: "Sara Mansouri", relation: "Daughter", age: 5, phone: "—" },
];

export default function FamilyMembersPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Family Members</h1>
        <Button>
          <UserPlus className="h-4 w-4 mr-1" />
          Add Member
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {familyMembers.map((member) => (
          <Card key={member.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {member.name.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{member.name}</p>
                  <Badge variant="secondary" className="text-xs">{member.relation}</Badge>
                </div>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Age: {member.age}</p>
                <p>Phone: {member.phone}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
