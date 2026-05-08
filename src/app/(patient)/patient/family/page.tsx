"use client";

import { UserPlus, Phone, Calendar, Edit2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age: number;
  phone: string;
  gender: string;
  insurance: string;
}

const initialMembers: FamilyMember[] = [
  { id: "f1", name: "Laila Mansouri", relation: "Wife", age: 33, phone: "+212 6 11 22 33 55", gender: "F", insurance: "CNSS" },
  { id: "f2", name: "Yassine Mansouri", relation: "Son", age: 8, phone: "\u2014", gender: "M", insurance: "CNSS" },
  { id: "f3", name: "Sara Mansouri", relation: "Daughter", age: 5, phone: "\u2014", gender: "F", insurance: "CNSS" },
];

const relationColors: Record<string, string> = {
  Wife: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  Husband: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Son: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Daughter: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  Parent: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export default function FamilyMembersPage() {
  const [members, setMembers] = useState(initialMembers);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newMember, setNewMember] = useState({ name: "", relation: "Wife", age: "", phone: "", gender: "F", insurance: "" });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleAdd = () => {
    setSaving(true);
    setTimeout(() => {
      const member: FamilyMember = {
        id: `f${Date.now()}`,
        name: newMember.name,
        relation: newMember.relation,
        age: parseInt(newMember.age, 10) || 0,
        phone: newMember.phone || "\u2014",
        gender: newMember.gender,
        insurance: newMember.insurance,
      };
      setMembers([...members, member]);
      setSaving(false);
      setSuccess(true);
      setTimeout(() => {
        setAddOpen(false);
        setSuccess(false);
        setNewMember({ name: "", relation: "Wife", age: "", phone: "", gender: "F", insurance: "" });
      }, 1500);
    }, 1000);
  };

  const handleDelete = (id: string) => {
    setMembers(members.filter((m) => m.id !== id));
    setDeleteId(null);
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "Patient", href: "/patient/dashboard" }, { label: "Family" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Family Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage family members under your account. {members.length} member{members.length !== 1 ? "s" : ""} added.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1" />
          Add Member
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <Card key={member.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {member.name.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{member.name}</p>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${relationColors[member.relation] ?? "bg-gray-100 text-gray-700"}`}>
                    {member.relation}
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Age: {member.age}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{member.phone}</span>
                </div>
                {member.insurance && (
                  <Badge variant="outline" className="text-xs">{member.insurance}</Badge>
                )}
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit2 className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(member.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Family Member</DialogTitle>
            <DialogDescription>Add a spouse, child, or other family member to your account.</DialogDescription>
          </DialogHeader>
          {success ? (
            <div className="text-center py-6">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mx-auto mb-3">
                <UserPlus className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">Family member added successfully!</p>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="memberName">Full Name</Label>
                <Input
                  id="memberName"
                  placeholder="First and last name"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="memberRelation">Relationship</Label>
                  <select
                    id="memberRelation"
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                    value={newMember.relation}
                    onChange={(e) => setNewMember({ ...newMember, relation: e.target.value })}
                  >
                    <option value="Wife">Wife</option>
                    <option value="Husband">Husband</option>
                    <option value="Son">Son</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Parent">Parent</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="memberAge">Age</Label>
                  <Input
                    id="memberAge"
                    type="number"
                    placeholder="Age"
                    value={newMember.age}
                    onChange={(e) => setNewMember({ ...newMember, age: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="memberGender">Gender</Label>
                  <select
                    id="memberGender"
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                    value={newMember.gender}
                    onChange={(e) => setNewMember({ ...newMember, gender: e.target.value })}
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="memberPhone">Phone</Label>
                  <Input
                    id="memberPhone"
                    type="tel"
                    placeholder="+212 6XX XX XX XX"
                    value={newMember.phone}
                    onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="memberInsurance">Insurance (optional)</Label>
                <select
                  id="memberInsurance"
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                  value={newMember.insurance}
                  onChange={(e) => setNewMember({ ...newMember, insurance: e.target.value })}
                >
                  <option value="">No insurance</option>
                  <option value="CNSS">CNSS</option>
                  <option value="CNOPS">CNOPS</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <Button className="w-full" onClick={handleAdd} disabled={saving || !newMember.name}>
                {saving ? "Adding..." : "Add Family Member"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Family Member</DialogTitle>
            <DialogDescription>Are you sure you want to remove this family member from your account?</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteId && handleDelete(deleteId)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
